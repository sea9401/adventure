import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  addMaterials,
  advanceCharacterClass,
  applyEstateTick,
  applyExp,
  applyHpRegen,
  getCrossedMilestones,
  canAfford,
  canCraft,
  changeCharacterClass,
  checkAchievements,
  computeStats,
  type AchievementClaim,
  CODEX_MATERIAL_COST,
  CODEX_MATERIAL_MAX_REGISTRATIONS,
  ensureCodex,
  findRegion,
  getMonumentBonus,
  getAvailableSkills,
  getClassSkills,
  getCodexAvailablePoints,
  getEquippedSkills,
  getMaxEquippedSkills,
  initialState,
  learnAdvancedSkill,
  removeAdvancedClass,
  resolveDispatch,
  subtractCost,
  subtractMaterials,
} from "./logic";
import {
  ACHIEVEMENTS,
  BOSS_COOLDOWN_MS,
  BOSS_DURATION_SEC,
  COOP_ATTACK_TURNS,
  COOP_BOSSES,
  CRAFTABLES,
  DISPATCH_REWARD_MULT,
  EQUIPMENT,
  TEST_REWARD_MULT,
  TREASURE_ROLL_PERIOD_SEC,
  getEquipmentResourceCost,
  getMaxBuildingLevel,
  MONUMENT_MAX_LEVEL,
  TOWN_HALL_MAX,
  upgradeCost,
} from "./data";
import type { DispatchDuration } from "./data";
import { resolveBossDispatch, simulateCoopAttack } from "./logic";
import type {
  ActiveCoopBoss,
  BossCombatLogEntry,
  CoopRewardTier,
  Materials,
  MaterialKind,
} from "./types";
import type {
  AchievementId,
  AdvancedClassId,
  ArenaSnapshot,
  ArenaTier,
  BossDispatchResult,
  CharacterClass,
  CodexStatKey,
  CraftableId,
  DispatchResult,
  EquipmentId,
  EquipmentSlot,
  GameState,
  GameStats,
  LastBattle,
  LogEntry,
  Notification,
  SetId,
  SkillId,
} from "./types";
import { buildArenaSnapshot, snapshotToRegion } from "./arena";
import { computeUnlockedTownIds, findTown } from "@/adventure/data/towns";

type Actions = {
  tick: () => void;
  startDispatch: (regionId: string, durationSec: DispatchDuration) => void;
  startBossDispatch: (regionId: string) => void;
  cancelDispatch: () => void;
  finalizeDispatch: () => Promise<void>;
  // 모험 탭 — 마을 이동 (해금된 마을만 허용)
  setTown: (townId: string) => void;
  // 레벨업 자유 분배 — STR/VIT/AGI/INT 4개 중 1포인트씩
  allocateStat: (stat: "str" | "vit" | "agi" | "int") => void;
  deallocateStat: (stat: "str" | "vit" | "agi" | "int") => void;
  changeClass: (cls: CharacterClass) => void;
  advanceClass: (id: AdvancedClassId) => { ok: boolean; error?: string };
  unadvance: () => void;
  learnSkill: (id: SkillId) => { ok: boolean; error?: string };
  toggleSkill: (id: SkillId) => void;
  moveSkill: (id: SkillId, direction: "up" | "down") => void;
  setCharacterName: (name: string) => void;
  craft: (id: CraftableId) => void;
  craftEquipment: (id: EquipmentId) => void;
  equipItem: (id: EquipmentId) => void;
  unequipItem: (slot: EquipmentSlot) => void;
  dismissAchievementToast: () => void;
  dismissMilestoneToast: () => void;
  dismissUniqueDropToast: () => void;
  dismissTutorial: () => void;
  dismissWelcome: () => void;
  // 알림 센터 (notification bell)
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  toggleCombatLog: () => void;
  toggleTheme: () => void;
  upgradeFarm: () => void;
  upgradeMine: () => void;
  upgradeInn: () => void;
  upgradeTraining: () => void;
  upgradeMonument: () => void;
  upgradeTownHall: () => void;
  coopSummon: (bossId: string) => Promise<{ ok: boolean; error?: string }>;
  coopAttack: (boss: ActiveCoopBoss) => Promise<{
    ok: boolean;
    damage?: number;
    damageTaken?: number;
    diedEarly?: boolean;
    log?: BossCombatLogEntry[];
    error?: string;
  }>;
  coopClaim: (sessionId: string) => Promise<{
    ok: boolean;
    reward?: { gold: number; iron: number; materials: Materials };
    tier?: CoopRewardTier;
    damageRatio?: number;
    error?: string;
  }>;
  registerArena: () => Promise<{ ok: boolean; error?: string }>;
  fightArena: (
    opponent: ArenaSnapshot,
    tier: ArenaTier,
  ) => { ok: boolean; result?: BossDispatchResult; error?: string };
  consumeAdminGrants: () => Promise<{
    ok: boolean;
    consumed: number;
    expGained: number;
    error?: string;
  }>;
  registerCodexMaterial: (id: MaterialKind) => { ok: boolean; error?: string };
  registerCodexEquipment: (id: EquipmentId) => { ok: boolean; error?: string };
  allocateCodexPoint: (stat: CodexStatKey) => { ok: boolean; error?: string };
  unallocateCodexPoint: (stat: CodexStatKey) => { ok: boolean; error?: string };
  resetCodexAllocation: () => void;
  reset: () => void;
  // ── Admin (테스트/조정용) ──
  adminSetLevel: (level: number) => void;
  adminAddExp: (amount: number) => void;
  adminAddSkillExp: (amount: number) => void;
  adminAddResources: (gold: number, iron: number) => void;
  adminAddMaterials: (mats: Materials) => void;
  adminSetBuilding: (
    slot: "farm" | "mine" | "inn" | "training" | "townHall",
    level: number,
  ) => void;
  adminGiveAllEquipment: () => void;
  adminEquipSet: (setId: SetId) => void;
  adminLearnAllAdvancedSkills: () => void;
  adminClaimAllAchievements: () => void;
  adminForceAdvance: (id: AdvancedClassId) => void;
};

export type AchievementToastInfo = {
  id: AchievementId;
  tier?: number; // tiered인 경우만
};

type Store = GameState &
  Actions & {
    _resolving: boolean;
    _achievementToast: AchievementToastInfo | null;
    _milestoneToast: { level: number } | null;
    _uniqueDropToast: { equipmentId: EquipmentId; bossName: string } | null;
  };

// 탐험 취소 시 부분 보상 — 우발 클릭 보호용 최소 경과 시간(초). 미만이면 보상 0.
const MIN_PARTIAL_SEC = 5;

// 모험 탭 — 레벨/보스 처치 카운트 기준으로 unlockedTownIds 동기화.
// 변경이 없으면 set 호출도 안 함.
function syncUnlockedTowns(set: (partial: Partial<Store>) => void, get: () => Store) {
  const s = get();
  const unlockedNow = computeUnlockedTownIds({
    level: s.character.level,
    bossKillCounts: s.stats.bossKillCounts,
  });
  const cur = s.unlockedTownIds ?? ["plains"];
  const newOnes = unlockedNow.filter((id) => !cur.includes(id));
  if (newOnes.length > 0) {
    set({ unlockedTownIds: Array.from(new Set([...cur, ...unlockedNow])) });
  }
}

// 조기 종료 LogEntry의 report 텍스트 — AI 호출은 건너뛰고 로컬 템플릿으로 짧게 요약.
function buildCancelReport(
  regionName: string,
  elapsedSec: number,
  partialKills: number,
  treasureHits: number,
): string {
  const min = Math.floor(elapsedSec / 60);
  const sec = elapsedSec % 60;
  const timeStr = min > 0 ? (sec > 0 ? `${min}분 ${sec}초` : `${min}분`) : `${sec}초`;
  const parts: string[] = [];
  if (partialKills > 0) {
    parts.push(`${regionName}에서 ${timeStr} 동안 ${partialKills}마리를 처치하고 발길을 돌렸다.`);
  } else {
    parts.push(`${regionName}에서 ${timeStr} 만에 발길을 돌렸다.`);
  }
  if (treasureHits > 0) {
    parts.push(treasureHits > 1 ? `보물도 ${treasureHits}번 마주쳤다.` : "보물도 하나 챙겼다.");
  }
  return parts.join(" ");
}

function processClaims(
  base: Pick<GameState, "resources" | "materials" | "stats" | "achievements" | "claimedTiers">,
  prevToast: AchievementToastInfo | null,
) {
  const claims = checkAchievements(base.stats, base.achievements, base.claimedTiers);
  const applied = applyAchievementRewards(base, claims);
  const toast: AchievementToastInfo | null = claims[0]
    ? {
        id: claims[0].id,
        tier: claims[0].kind === "tier" ? claims[0].tier : undefined,
      }
    : prevToast;
  return { ...applied, toast };
}

function applyAchievementRewards(
  state: Pick<GameState, "resources" | "materials" | "stats" | "achievements" | "claimedTiers">,
  claims: AchievementClaim[],
): Pick<GameState, "resources" | "materials" | "achievements" | "claimedTiers"> {
  const resources = { ...state.resources };
  const materials = { ...state.materials };
  const achievements = [...state.achievements];
  const claimedTiers = { ...state.claimedTiers };

  for (const c of claims) {
    const ach = ACHIEVEMENTS[c.id];
    let reward;
    if (c.kind === "single" && ach.kind === "single") {
      achievements.push(c.id);
      reward = ach.reward;
    } else if (c.kind === "tier" && ach.kind === "tiered") {
      claimedTiers[c.id] = c.tier;
      reward = ach.tiers[c.tier - 1].reward;
    }
    if (!reward) continue;
    if (reward.gold) resources.gold += reward.gold;
    if (reward.iron) resources.iron += reward.iron;
    if (reward.materials) {
      for (const [k, v] of Object.entries(reward.materials)) {
        if (!v) continue;
        materials[k as keyof typeof materials] = (materials[k as keyof typeof materials] ?? 0) + v;
      }
    }
  }
  return { resources, materials, achievements, claimedTiers };
}

function statsAfterEvent(
  base: GameStats,
  evt: Partial<GameStats> & {
    addKills?: number;
    addBossKill?: string;
    addCoopDefeat?: number;
    addGold?: number;
    addIron?: number;
    addDispatches?: number;
    addAlchemy?: number;
    addEquip?: number;
    addDeath?: number;
    addDodges?: number;
    addDamageTaken?: number;
    addDamageDealt?: number;
    bossClear?: { name: string; turns: number };
    maxHitCandidate?: number;
    classSeen?: CharacterClass;
    levelReached?: number;
  },
): GameStats {
  const out: GameStats = {
    ...base,
    classesUsed: [...base.classesUsed],
    bossDefeatedNames: [...base.bossDefeatedNames],
    bossKillCounts: { ...base.bossKillCounts },
    bossClearStats: { ...(base.bossClearStats ?? {}) },
  };
  if (evt.addKills) out.totalKills += evt.addKills;
  if (evt.addBossKill) {
    out.totalBossKills += 1;
    out.bossKillCounts[evt.addBossKill] = (out.bossKillCounts[evt.addBossKill] ?? 0) + 1;
    if (!out.bossDefeatedNames.includes(evt.addBossKill)) {
      out.bossDefeatedNames.push(evt.addBossKill);
    }
  }
  if (evt.addCoopDefeat) out.totalCoopBossDefeats += evt.addCoopDefeat;
  if (evt.addGold) out.totalGoldEarned += evt.addGold;
  if (evt.addIron) out.totalIronEarned += evt.addIron;
  if (evt.addDispatches) out.totalDispatches += evt.addDispatches;
  if (evt.addAlchemy) out.totalAlchemyCrafted += evt.addAlchemy;
  if (evt.addEquip) out.totalEquipmentCrafted += evt.addEquip;
  if (evt.addDeath) out.totalDeaths += evt.addDeath;
  if (evt.addDodges) out.totalDodges += evt.addDodges;
  if (evt.addDamageTaken) out.totalDamageTaken += evt.addDamageTaken;
  if (evt.addDamageDealt) out.totalDamageDealt = (out.totalDamageDealt ?? 0) + evt.addDamageDealt;
  if (evt.bossClear) {
    const cur = out.bossClearStats?.[evt.bossClear.name] ?? { totalTurns: 0, clears: 0 };
    out.bossClearStats = {
      ...(out.bossClearStats ?? {}),
      [evt.bossClear.name]: {
        totalTurns: cur.totalTurns + evt.bossClear.turns,
        clears: cur.clears + 1,
      },
    };
  }
  if (evt.maxHitCandidate && evt.maxHitCandidate > out.maxSingleHit) {
    out.maxSingleHit = evt.maxHitCandidate;
  }
  if (evt.classSeen && !out.classesUsed.includes(evt.classSeen)) {
    out.classesUsed.push(evt.classSeen);
  }
  if (evt.levelReached && evt.levelReached > out.highestLevel) {
    out.highestLevel = evt.levelReached;
  }
  return out;
}

async function finalizeBossDispatchInternal(
  s: Store,
  region: ReturnType<typeof findRegion>,
  set: (partial: Partial<Store>) => void,
  get: () => Store,
) {
  if (!region || !region.boss) {
    set({ dispatch: null });
    return;
  }
  set({ _resolving: true });
  // Use pre-computed result if available, else simulate now (fallback)
  const monBonus = getMonumentBonus(s.estate.monument, s.stats.bossKillCounts);
  const result =
    s.dispatch?.bossResult ?? resolveBossDispatch(s.character, region, s.guild, monBonus);

  let report = "";
  try {
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        region: { name: region.name, flavor: region.flavor },
        character: {
          name: s.character.name,
          level: s.character.level,
          className: result.className,
        },
        boss: {
          name: result.bossName,
          defeated: result.defeated,
          turns: result.totalTurns,
          damageDealt: result.damageDealt,
          damageTaken: result.damageTaken,
          dodgesByPlayer: result.dodgesByPlayer,
          dodgesByEnemy: result.dodgesByEnemy,
          skillActivations: result.skillActivations,
          diedEarly: result.diedEarly,
        },
        gained: result.gained,
        droppedMaterials: result.droppedMaterials,
        guildReputation: s.guild.reputation,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { report: string };
      report = data.report;
    } else {
      report = result.defeated
        ? `${result.bossName}을 쓰러뜨렸다!`
        : `${result.bossName}에게 패배했다.`;
    }
  } catch {
    report = result.defeated
      ? `${result.bossName}을 쓰러뜨렸다!`
      : `${result.bossName}에게 패배했다.`;
  }

  const after = get();
  const newResources = {
    gold: after.resources.gold + (result.gained.gold ?? 0),
    iron: after.resources.iron + (result.gained.iron ?? 0),
  };
  const newMaterials = addMaterials(after.materials, result.droppedMaterials);
  const newEquipmentInventory = result.droppedUniqueEquipment
    ? {
        ...after.equipmentInventory,
        [result.droppedUniqueEquipment]:
          (after.equipmentInventory[result.droppedUniqueEquipment] ?? 0) + 1,
      }
    : after.equipmentInventory;
  // 기록의 서 — 장비 자동 등록 (획득 시점, 미등록 ID만)
  const codexBeforeDrop = ensureCodex(after.character.codex);
  const codexWithDrop =
    result.droppedUniqueEquipment &&
    !codexBeforeDrop.equipment.includes(result.droppedUniqueEquipment)
      ? {
          ...codexBeforeDrop,
          equipment: [...codexBeforeDrop.equipment, result.droppedUniqueEquipment],
        }
      : codexBeforeDrop;
  const characterAfterCombat = {
    ...after.character,
    currentHp: result.finalHp,
    codex: codexWithDrop,
  };
  const newCharacter = applyExp(characterAfterCombat, result.exp);
  const crossedMilestones = getCrossedMilestones(after.character.level, newCharacter.level);
  const newGuild = result.defeated
    ? { reputation: Math.min(1000, after.guild.reputation + 5) }
    : after.guild;

  const entry: LogEntry = {
    at: Date.now(),
    regionName: region.name,
    className: result.className,
    durationSec: BOSS_DURATION_SEC,
    kills: result.defeated ? [{ name: result.bossName, count: 1 }] : [],
    totalKills: result.defeated ? 1 : 0,
    damageDealt: result.damageDealt,
    damageTaken: result.damageTaken,
    dodgesByPlayer: result.dodgesByPlayer,
    dodgesByEnemy: result.dodgesByEnemy,
    skillActivations: result.skillActivations,
    diedEarly: result.diedEarly,
    gained: result.gained,
    exp: result.exp,
    droppedMaterials: result.droppedMaterials,
    droppedUniqueEquipment: result.droppedUniqueEquipment,
    treasure: null,
    isBoss: true,
    bossName: result.bossName,
    bossDefeated: result.defeated,
    report,
  };

  // Update stats
  const newStats = statsAfterEvent(after.stats, {
    addDispatches: 1,
    addGold: result.gained.gold,
    addIron: result.gained.iron,
    addBossKill: result.defeated ? result.bossName : undefined,
    addDeath: result.diedEarly ? 1 : 0,
    addDodges: result.dodgesByPlayer,
    addDamageTaken: result.damageTaken,
    addDamageDealt: result.damageDealt,
    bossClear: result.defeated ? { name: result.bossName, turns: result.totalTurns } : undefined,
    maxHitCandidate: result.maxSingleHit,
    levelReached: newCharacter.level,
  });
  // Achievements
  const r = processClaims(
    {
      resources: newResources,
      materials: newMaterials,
      stats: newStats,
      achievements: after.achievements,
      claimedTiers: after.claimedTiers,
    },
    null,
  );

  const characterMaxHp = computeStats(
    s.character,
    getMonumentBonus(s.estate.monument, s.stats.bossKillCounts),
  ).maxHp;
  const newBattle: LastBattle = {
    kind: "boss",
    at: Date.now(),
    regionName: region.name,
    bossName: result.bossName,
    bossMaxHp: region.boss.hp,
    characterMaxHp,
    result,
  };
  // 알림 센터 — 유니크 드랍 시 추가 (영구 기록, 토스트와 별개)
  const newNotifications: Notification[] = [...(after.notifications ?? [])];
  if (result.droppedUniqueEquipment) {
    const def = EQUIPMENT[result.droppedUniqueEquipment];
    newNotifications.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "unique_drop",
      title: "유니크 드랍!",
      message: `${result.bossName} 처치 보상 — ${def.name}`,
      at: Date.now(),
      read: false,
      equipmentId: result.droppedUniqueEquipment,
      bossName: result.bossName,
    });
    if (newNotifications.length > 50) newNotifications.length = 50;
  }
  set({
    dispatch: null,
    _resolving: false,
    resources: r.resources,
    materials: r.materials,
    equipmentInventory: newEquipmentInventory,
    character: newCharacter,
    hpUpdatedAt: Date.now(),
    guild: newGuild,
    log: [entry, ...after.log].slice(0, 20),
    bossCooldowns: {
      ...after.bossCooldowns,
      [region.id]: Date.now() + BOSS_COOLDOWN_MS,
    },
    stats: newStats,
    achievements: r.achievements,
    claimedTiers: r.claimedTiers,
    _achievementToast: r.toast,
    ...(crossedMilestones.length > 0
      ? { _milestoneToast: { level: crossedMilestones[crossedMilestones.length - 1] } }
      : {}),
    ...(result.droppedUniqueEquipment
      ? {
          _uniqueDropToast: {
            equipmentId: result.droppedUniqueEquipment,
            bossName: result.bossName,
          },
        }
      : {}),
    lastBattles: [newBattle, ...(after.lastBattles ?? [])].slice(0, 3),
    notifications: newNotifications,
  });
  syncUnlockedTowns(set, get);
}

export const useGame = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState(),
      _resolving: false,
      _achievementToast: null,
      _milestoneToast: null,
      _uniqueDropToast: null,

      tick: () => {
        const s = get();
        const estateResult = applyEstateTick(s.estate, s.resources, s.character);
        // 탐험 중에는 store HP 회복을 멈춘다 — 회복은 전투 시뮬레이션 안에서
        // 매 턴 적용되며 result.finalHp에 반영됨. 여기서 또 더하면 이중 계산.
        if (s.dispatch) {
          set({
            estate: estateResult.estate,
            resources: estateResult.resources,
            character: estateResult.character,
            // hpUpdatedAt은 그대로 두면 탐험 종료 직후 큰 점프가 생기므로 갱신
            hpUpdatedAt: Date.now(),
            lastSeenAt: Date.now(),
          });
          return;
        }
        const regenResult = applyHpRegen(
          estateResult.character,
          estateResult.estate,
          s.hpUpdatedAt,
        );
        set({
          estate: estateResult.estate,
          resources: estateResult.resources,
          character: regenResult.character,
          hpUpdatedAt: regenResult.hpUpdatedAt,
          lastSeenAt: Date.now(),
        });
      },

      startDispatch: (regionId, durationSec) => {
        const s = get();
        if (s.dispatch) return;
        if (s.character.currentHp <= 0) return;
        const region = findRegion(regionId);
        if (!region) return;
        // 전투 미리 계산 — 사망 시 즉시 종료를 위함
        const monBonus = getMonumentBonus(s.estate.monument, s.stats.bossKillCounts);
        const result = resolveDispatch(
          s.character,
          region,
          s.guild,
          durationSec,
          monBonus,
          s.estate.inn,
        );
        // 사망 시 totalTurns(=죽은 시점)까지만 재생, 정상 완료면 원래 시간
        const playbackSec = result.diedEarly
          ? Math.max(1, Math.min(durationSec, result.totalTurns))
          : durationSec;
        const now = Date.now();
        set({
          dispatch: {
            regionId,
            startedAt: now,
            endsAt: now + playbackSec * 1000,
            durationSec: playbackSec,
            dispatchResult: result,
          },
        });
      },

      startBossDispatch: (regionId) => {
        const s = get();
        if (s.dispatch) return;
        if (s.character.currentHp <= 0) return;
        const region = findRegion(regionId);
        if (!region || !region.boss) return;
        const cd = s.bossCooldowns[regionId] ?? 0;
        if (Date.now() < cd) return;

        // Pre-compute combat with full turn log
        const monBonus = getMonumentBonus(s.estate.monument, s.stats.bossKillCounts);
        const result = resolveBossDispatch(s.character, region, s.guild, monBonus);
        const now = Date.now();
        // 턴당 1초 페이스 — 실제 진행 턴 수만큼만 재생
        const playbackSec = Math.max(1, Math.min(BOSS_DURATION_SEC, result.totalTurns));
        set({
          dispatch: {
            regionId,
            startedAt: now,
            endsAt: now + playbackSec * 1000,
            durationSec: playbackSec,
            isBoss: true,
            bossResult: result,
          },
        });
      },

      setTown: (townId) => {
        const s = get();
        if (s.dispatch) return; // 전투 중 이동 금지
        const target = findTown(townId);
        if (!target) return;
        const unlocked = s.unlockedTownIds ?? ["plains"];
        if (!unlocked.includes(target.id)) return;
        if (s.currentTownId === target.id) return;
        set({ currentTownId: target.id });
      },

      allocateStat: (stat) => {
        const s = get();
        if (s.dispatch) return; // 전투 중 분배 금지
        const points = s.character.statPoints ?? 0;
        if (points <= 0) return;
        const cur = s.character.allocatedStats ?? { str: 0, vit: 0, agi: 0, int: 0 };
        const oldMaxHp = computeStats(
          s.character,
          getMonumentBonus(s.estate.monument, s.stats.bossKillCounts),
        ).maxHp;
        const newCharacter = {
          ...s.character,
          statPoints: points - 1,
          allocatedStats: { ...cur, [stat]: (cur[stat] ?? 0) + 1 },
        };
        const newMaxHp = computeStats(
          newCharacter,
          getMonumentBonus(s.estate.monument, s.stats.bossKillCounts),
        ).maxHp;
        // VIT 분배 시 maxHp 증가분만큼 currentHp도 동반 증가 (편의)
        const hpDelta = Math.max(0, newMaxHp - oldMaxHp);
        set({
          character: { ...newCharacter, currentHp: newCharacter.currentHp + hpDelta },
          hpUpdatedAt: Date.now(),
        });
      },

      deallocateStat: (stat) => {
        const s = get();
        if (s.dispatch) return;
        const cur = s.character.allocatedStats ?? { str: 0, vit: 0, agi: 0, int: 0 };
        const allocated = cur[stat] ?? 0;
        if (allocated <= 0) return;
        const points = s.character.statPoints ?? 0;
        const newCharacter = {
          ...s.character,
          statPoints: points + 1,
          allocatedStats: { ...cur, [stat]: allocated - 1 },
        };
        const newMaxHp = computeStats(
          newCharacter,
          getMonumentBonus(s.estate.monument, s.stats.bossKillCounts),
        ).maxHp;
        // VIT 회수 시 currentHp가 maxHp 초과하면 클램프
        const clamped = Math.min(newCharacter.currentHp, newMaxHp);
        set({
          character: { ...newCharacter, currentHp: clamped },
          hpUpdatedAt: Date.now(),
        });
      },

      cancelDispatch: () => {
        const s = get();
        if (!s.dispatch || s._resolving) return;
        // 자동 종료 시점 도달 → 정산은 finalizeDispatch에 위임 (다음 tick).
        if (Date.now() >= s.dispatch.endsAt) return;

        // 보스 — 부분 보상 대상 외, 보상 0으로 폐기.
        if (s.dispatch.isBoss) {
          set({ dispatch: null });
          return;
        }

        const result = s.dispatch.dispatchResult;
        if (!result) {
          set({ dispatch: null });
          return;
        }
        // 레거시 dispatch — 본 기능 도입 전에 시작된 탐험은 raw 누적값/treasureRolls가
        // 직렬화 상태에 없어 비례 계산 불가. 보상 0으로 폐기 (이전 동작과 동일).
        if (result.killsGoldRaw === undefined || !result.treasureRolls) {
          set({ dispatch: null });
          return;
        }

        const playbackSec = s.dispatch.durationSec;
        const elapsedSec = Math.max(
          0,
          Math.min(playbackSec, Math.floor((Date.now() - s.dispatch.startedAt) / 1000)),
        );
        // 최소 경과 시간 미만 → 우발 클릭 보호, 보상 0.
        if (elapsedSec < MIN_PARTIAL_SEC) {
          set({ dispatch: null });
          return;
        }

        const region = findRegion(s.dispatch.regionId);
        if (!region) {
          set({ dispatch: null });
          return;
        }

        const progress = playbackSec > 0 ? elapsedSec / playbackSec : 0;

        // === 1. 부분 결과 빌드 ===
        // 1.1 적 처치 raw → progress 비례 + 보물 굴림은 elapsedSec까지만 유효.
        const elapsedRolls = Math.floor(elapsedSec / TREASURE_ROLL_PERIOD_SEC);
        const activeRolls = result.treasureRolls.slice(0, elapsedRolls);
        let partialHits = 0;
        if (region.treasure) {
          for (const r of activeRolls) {
            if (r < region.treasure.chance) partialHits++;
          }
        }
        const treasureGoldRaw =
          partialHits > 0 && region.treasure ? (region.treasure.gold ?? 0) * partialHits : 0;
        const treasureIronRaw =
          partialHits > 0 && region.treasure ? (region.treasure.iron ?? 0) * partialHits : 0;
        const treasureMatsRaw: Materials = {};
        if (partialHits > 0 && region.treasure?.materials) {
          for (const [k, v] of Object.entries(region.treasure.materials)) {
            if (v) treasureMatsRaw[k as MaterialKind] = v * partialHits;
          }
        }

        // 1.2 finalMult — 출발 시점에 선택한 길이의 효율 그대로 적용 (doc 18 §2.1).
        const guildMult = Math.min(1.5, 1 + s.guild.reputation * 0.0005);
        const durationMult = DISPATCH_REWARD_MULT[result.durationSec as DispatchDuration] ?? 1.0;
        const finalMult = guildMult * durationMult * TEST_REWARD_MULT;
        const expMult = durationMult * TEST_REWARD_MULT;

        const partialGold = Math.floor(
          (result.killsGoldRaw * progress + treasureGoldRaw) * finalMult,
        );
        const partialIron = Math.floor(
          (result.killsIronRaw * progress + treasureIronRaw) * finalMult,
        );
        const partialExp = Math.floor(result.killsExpRaw * progress * expMult);

        // 1.3 재료 — 처치분(progress 비례) + 보물분(통째). finalMult 미적용.
        const partialMaterials: Materials = {};
        for (const [k, v] of Object.entries(result.killsMaterialsRaw)) {
          if (v) {
            const scaled = Math.floor(v * progress);
            if (scaled > 0) partialMaterials[k as MaterialKind] = scaled;
          }
        }
        for (const [k, v] of Object.entries(treasureMatsRaw)) {
          if (v) {
            partialMaterials[k as MaterialKind] = (partialMaterials[k as MaterialKind] ?? 0) + v;
          }
        }

        // 1.4 kills 배열 비례 (totalKills는 합산으로 일관성 유지).
        const partialKills = result.kills
          .map((k) => ({ ...k, count: Math.floor(k.count * progress) }))
          .filter((k) => k.count > 0);
        const partialTotalKills = partialKills.reduce((sum, k) => sum + k.count, 0);

        // 1.5 HP — 풀 로그가 있으면 초 단위, 없으면 분당 샘플로 fallback.
        const logIdx = elapsedSec - 1;
        let partialFinalHp = s.character.currentHp;
        if (logIdx >= 0 && logIdx < result.log.length) {
          partialFinalHp = result.log[logIdx].playerHpAfter;
        } else if (result.hpAtMinute.length > 0) {
          const minuteIdx = Math.min(
            result.hpAtMinute.length - 1,
            Math.max(0, Math.floor(elapsedSec / 60) - 1),
          );
          partialFinalHp = result.hpAtMinute[minuteIdx];
        }

        const partialResult: DispatchResult = {
          ...result,
          durationSec: elapsedSec,
          kills: partialKills,
          totalKills: partialTotalKills,
          damageDealt: Math.floor(result.damageDealt * progress),
          damageTaken: Math.floor(result.damageTaken * progress),
          dodgesByPlayer: Math.floor(result.dodgesByPlayer * progress),
          dodgesByEnemy: Math.floor(result.dodgesByEnemy * progress),
          finalHp: partialFinalHp,
          diedEarly: false,
          gained: { gold: partialGold, iron: partialIron },
          exp: partialExp,
          droppedMaterials: partialMaterials,
          treasure: partialHits > 0 ? region.treasure! : null,
          treasureHits: partialHits,
          // BattleLogViewer가 elapsed 분량만 재생하도록 로그 트림.
          log: result.log.slice(0, elapsedSec),
        };

        // === 2. 보상 적용 (finalizeDispatch 정산 로직 동일) ===
        const newResources = {
          gold: s.resources.gold + partialGold,
          iron: s.resources.iron + partialIron,
        };
        const newMaterials = addMaterials(s.materials, partialMaterials);
        const characterAfterCombat = { ...s.character, currentHp: partialFinalHp };
        const newCharacter = applyExp(characterAfterCombat, partialExp);
        const crossedMilestones = getCrossedMilestones(s.character.level, newCharacter.level);
        const newGuild =
          partialTotalKills > 0
            ? {
                reputation: Math.min(1000, s.guild.reputation + Math.min(5, partialTotalKills)),
              }
            : s.guild;

        const entry: LogEntry = {
          at: Date.now(),
          regionName: region.name,
          className: result.className,
          durationSec: elapsedSec,
          kills: partialKills,
          totalKills: partialTotalKills,
          damageDealt: partialResult.damageDealt,
          damageTaken: partialResult.damageTaken,
          dodgesByPlayer: partialResult.dodgesByPlayer,
          dodgesByEnemy: partialResult.dodgesByEnemy,
          skillActivations: result.skillActivations,
          diedEarly: false,
          gained: { gold: partialGold, iron: partialIron },
          exp: partialExp,
          droppedMaterials: partialMaterials,
          treasure: partialResult.treasure,
          treasureHits: partialHits,
          earlyExit: "cancel",
          report: buildCancelReport(region.name, elapsedSec, partialTotalKills, partialHits),
        };

        const newStats = statsAfterEvent(s.stats, {
          addDispatches: 1,
          addKills: partialTotalKills,
          addGold: partialGold,
          addIron: partialIron,
          addDeath: 0,
          addDodges: partialResult.dodgesByPlayer,
          addDamageTaken: partialResult.damageTaken,
          addDamageDealt: partialResult.damageDealt,
          maxHitCandidate: result.maxSingleHit,
          levelReached: newCharacter.level,
        });
        const r = processClaims(
          {
            resources: newResources,
            materials: newMaterials,
            stats: newStats,
            achievements: s.achievements,
            claimedTiers: s.claimedTiers,
          },
          null,
        );

        const characterMaxHp = computeStats(
          s.character,
          getMonumentBonus(s.estate.monument, s.stats.bossKillCounts),
        ).maxHp;
        const newBattle: LastBattle = {
          kind: "field",
          at: Date.now(),
          regionName: region.name,
          characterMaxHp,
          result: partialResult,
        };

        set({
          dispatch: null,
          resources: r.resources,
          materials: r.materials,
          character: newCharacter,
          hpUpdatedAt: Date.now(),
          guild: newGuild,
          log: [entry, ...s.log].slice(0, 20),
          stats: newStats,
          achievements: r.achievements,
          claimedTiers: r.claimedTiers,
          _achievementToast: r.toast,
          ...(crossedMilestones.length > 0
            ? {
                _milestoneToast: {
                  level: crossedMilestones[crossedMilestones.length - 1],
                },
              }
            : {}),
          lastBattles: [newBattle, ...(s.lastBattles ?? [])].slice(0, 3),
        });
      },

      finalizeDispatch: async () => {
        const s = get();
        if (!s.dispatch || s._resolving) return;
        if (Date.now() < s.dispatch.endsAt) return;
        const region = findRegion(s.dispatch.regionId);
        if (!region) {
          set({ dispatch: null });
          return;
        }

        if (s.dispatch.isBoss) {
          await finalizeBossDispatchInternal(s, region, set, get);
          return;
        }

        set({ _resolving: true });
        // startDispatch에서 미리 계산한 결과 사용 (없으면 fallback)
        const monBonus = getMonumentBonus(s.estate.monument, s.stats.bossKillCounts);
        const result =
          s.dispatch.dispatchResult ??
          resolveDispatch(
            s.character,
            region,
            s.guild,
            s.dispatch.durationSec as DispatchDuration,
            monBonus,
            s.estate.inn,
          );

        let report = "";
        try {
          const res = await fetch("/api/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              region: { name: region.name, flavor: region.flavor },
              character: {
                name: s.character.name,
                level: s.character.level,
                className: result.className,
              },
              dispatch: {
                durationSec: result.durationSec,
                kills: result.kills,
                totalKills: result.totalKills,
                damageDealt: result.damageDealt,
                damageTaken: result.damageTaken,
                dodgesByPlayer: result.dodgesByPlayer,
                dodgesByEnemy: result.dodgesByEnemy,
                skillActivations: result.skillActivations,
                diedEarly: result.diedEarly,
              },
              gained: result.gained,
              droppedMaterials: result.droppedMaterials,
              treasure: result.treasure,
              guildReputation: s.guild.reputation,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { report: string };
            report = data.report;
          } else {
            report = `${region.name}에서 ${result.totalKills}마리를 처치하고 돌아왔다.`;
          }
        } catch {
          report = `${region.name}에서 ${result.totalKills}마리를 처치하고 돌아왔다.`;
        }

        const after = get();
        const newResources = {
          gold: after.resources.gold + (result.gained.gold ?? 0),
          iron: after.resources.iron + (result.gained.iron ?? 0),
        };
        const newMaterials = addMaterials(after.materials, result.droppedMaterials);
        const characterAfterCombat = {
          ...after.character,
          currentHp: result.finalHp,
        };
        const newCharacter = applyExp(characterAfterCombat, result.exp);
        const crossedMilestones = getCrossedMilestones(after.character.level, newCharacter.level);
        const newGuild =
          result.totalKills > 0
            ? {
                reputation: Math.min(1000, after.guild.reputation + Math.min(5, result.totalKills)),
              }
            : after.guild;

        const entry: LogEntry = {
          at: Date.now(),
          regionName: region.name,
          className: result.className,
          durationSec: result.durationSec,
          kills: result.kills,
          totalKills: result.totalKills,
          damageDealt: result.damageDealt,
          damageTaken: result.damageTaken,
          dodgesByPlayer: result.dodgesByPlayer,
          dodgesByEnemy: result.dodgesByEnemy,
          skillActivations: result.skillActivations,
          diedEarly: result.diedEarly,
          gained: result.gained,
          exp: result.exp,
          droppedMaterials: result.droppedMaterials,
          treasure: result.treasure,
          treasureHits: result.treasureHits,
          report,
        };

        const newStats = statsAfterEvent(after.stats, {
          addDispatches: 1,
          addKills: result.totalKills,
          addGold: result.gained.gold,
          addIron: result.gained.iron,
          addDeath: result.diedEarly ? 1 : 0,
          addDodges: result.dodgesByPlayer,
          addDamageTaken: result.damageTaken,
          addDamageDealt: result.damageDealt,
          maxHitCandidate: result.maxSingleHit,
          levelReached: newCharacter.level,
        });
        const r = processClaims(
          {
            resources: newResources,
            materials: newMaterials,
            stats: newStats,
            achievements: after.achievements,
            claimedTiers: after.claimedTiers,
          },
          null,
        );

        const characterMaxHp = computeStats(
          s.character,
          getMonumentBonus(s.estate.monument, s.stats.bossKillCounts),
        ).maxHp;
        const newBattle: LastBattle = {
          kind: "field",
          at: Date.now(),
          regionName: region.name,
          characterMaxHp,
          result,
        };
        set({
          dispatch: null,
          _resolving: false,
          resources: r.resources,
          materials: r.materials,
          character: newCharacter,
          hpUpdatedAt: Date.now(),
          guild: newGuild,
          log: [entry, ...after.log].slice(0, 20),
          stats: newStats,
          achievements: r.achievements,
          claimedTiers: r.claimedTiers,
          _achievementToast: r.toast,
          ...(crossedMilestones.length > 0
            ? { _milestoneToast: { level: crossedMilestones[crossedMilestones.length - 1] } }
            : {}),
          lastBattles: [newBattle, ...(after.lastBattles ?? [])].slice(0, 3),
        });
        syncUnlockedTowns(set, get);
      },

      changeClass: (cls) => {
        const s = get();
        // 2차 전직 상태에선 1차 클래스 변경 차단 (먼저 unadvance 필요)
        if (s.character.advancedClass) return;
        const updated = changeCharacterClass(s.character, cls);
        const newStats = statsAfterEvent(s.stats, { classSeen: cls });
        const r = processClaims(
          {
            resources: s.resources,
            materials: s.materials,
            stats: newStats,
            achievements: s.achievements,
            claimedTiers: s.claimedTiers,
          },
          s._achievementToast,
        );
        set({
          character: updated,
          hpUpdatedAt: Date.now(),
          stats: newStats,
          resources: r.resources,
          materials: r.materials,
          achievements: r.achievements,
          claimedTiers: r.claimedTiers,
          _achievementToast: r.toast,
        });
      },

      advanceClass: (id) => {
        const s = get();
        const updated = advanceCharacterClass(s.character, id);
        if (!updated) return { ok: false, error: "조건 불충족 (Lv 100 + 같은 직군 필요)" };
        set({ character: updated, hpUpdatedAt: Date.now() });
        return { ok: true };
      },

      unadvance: () => {
        const s = get();
        if (!s.character.advancedClass) return;
        const updated = removeAdvancedClass(s.character);
        set({ character: updated, hpUpdatedAt: Date.now() });
      },

      learnSkill: (id) => {
        const s = get();
        const updated = learnAdvancedSkill(s.character, id);
        if (!updated) return { ok: false, error: "학습 불가 (skillExp 부족 or 이미 학습)" };
        set({ character: updated });
        return { ok: true };
      },

      toggleSkill: (id) => {
        const s = get();
        const character = s.character;
        const available = getAvailableSkills(character);
        const def = available.find((sk) => sk.id === id);
        if (!def) return;

        const currentEquipped =
          character.equippedSkills ?? getEquippedSkills(character).map((sk) => sk.id);

        const isEquipped = currentEquipped.includes(id);
        let newEquipped: SkillId[];
        if (isEquipped) {
          newEquipped = currentEquipped.filter((eid) => eid !== id);
        } else {
          if (currentEquipped.length >= getMaxEquippedSkills(character)) return;
          newEquipped = [...currentEquipped, id];
        }
        set({ character: { ...character, equippedSkills: newEquipped } });
      },

      moveSkill: (id, direction) => {
        const s = get();
        const character = s.character;
        const current = character.equippedSkills ?? getEquippedSkills(character).map((sk) => sk.id);
        const idx = current.indexOf(id);
        if (idx < 0) return;
        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= current.length) return;
        const next = [...current];
        [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
        set({ character: { ...character, equippedSkills: next } });
      },

      craftEquipment: (id) => {
        const s = get();
        const def = EQUIPMENT[id];
        if (!def) return;
        const resCost = getEquipmentResourceCost(def);
        if (!canCraft(s.materials, def.cost)) return;
        if (s.resources.gold < resCost.gold || s.resources.iron < resCost.iron) return;
        const newMaterials = subtractMaterials(s.materials, def.cost);
        const newResources = {
          gold: s.resources.gold - resCost.gold,
          iron: s.resources.iron - resCost.iron,
        };
        const newInv = {
          ...s.equipmentInventory,
          [id]: (s.equipmentInventory[id] ?? 0) + 1,
        };
        const newStats = statsAfterEvent(s.stats, { addEquip: 1 });
        // 기록의 서 — 제작 시 자동 등록 (미등록 ID만)
        const codexBefore = ensureCodex(s.character.codex);
        const newCodex = codexBefore.equipment.includes(id)
          ? codexBefore
          : { ...codexBefore, equipment: [...codexBefore.equipment, id] };
        const r = processClaims(
          {
            resources: newResources,
            materials: newMaterials,
            stats: newStats,
            achievements: s.achievements,
            claimedTiers: s.claimedTiers,
          },
          s._achievementToast,
        );
        set({
          materials: r.materials,
          equipmentInventory: newInv,
          resources: r.resources,
          stats: newStats,
          achievements: r.achievements,
          claimedTiers: r.claimedTiers,
          _achievementToast: r.toast,
          character: { ...s.character, codex: newCodex },
        });
      },

      equipItem: (id) => {
        const s = get();
        const def = EQUIPMENT[id];
        if (!def) return;
        if ((s.equipmentInventory[id] ?? 0) <= 0) return;
        const equipped = { ...(s.character.equipped ?? {}) };
        equipped[def.slot] = id;
        set({ character: { ...s.character, equipped }, hpUpdatedAt: Date.now() });
      },

      unequipItem: (slot) => {
        const s = get();
        const equipped = { ...(s.character.equipped ?? {}) };
        delete equipped[slot];
        set({ character: { ...s.character, equipped }, hpUpdatedAt: Date.now() });
      },

      setCharacterName: (name) => {
        const s = get();
        const current = s.character.name;
        if (current && current !== "모험가") return;
        const trimmed = name.trim().slice(0, 20);
        if (!trimmed) return;
        set({ character: { ...s.character, name: trimmed } });
      },

      craft: (id) => {
        const s = get();
        const item = CRAFTABLES[id];
        if (!item) return;
        if (!canCraft(s.materials, item.cost)) return;
        let newMaterials = subtractMaterials(s.materials, item.cost);
        if (item.output) {
          newMaterials = {
            ...newMaterials,
            [item.output.material]: (newMaterials[item.output.material] ?? 0) + item.output.count,
          };
        }
        const newCrafted = {
          ...s.crafted,
          [id]: (s.crafted[id] ?? 0) + 1,
        };
        const newStats = statsAfterEvent(s.stats, { addAlchemy: 1 });
        const r = processClaims(
          {
            resources: s.resources,
            materials: newMaterials,
            stats: newStats,
            achievements: s.achievements,
            claimedTiers: s.claimedTiers,
          },
          s._achievementToast,
        );
        set({
          materials: r.materials,
          crafted: newCrafted,
          resources: r.resources,
          stats: newStats,
          achievements: r.achievements,
          claimedTiers: r.claimedTiers,
          _achievementToast: r.toast,
        });
      },

      upgradeFarm: () => {
        const s = get();
        const cap = getMaxBuildingLevel(s.estate.townHall ?? 1);
        if (s.estate.farm >= cap) return;
        const cost = upgradeCost("farm", s.estate.farm);
        if (!canAfford(s.resources, cost)) return;
        set({
          resources: subtractCost(s.resources, cost),
          estate: { ...s.estate, farm: s.estate.farm + 1 },
        });
      },

      upgradeMine: () => {
        const s = get();
        const cap = getMaxBuildingLevel(s.estate.townHall ?? 1);
        if (s.estate.mine >= cap) return;
        const cost = upgradeCost("mine", s.estate.mine);
        if (!canAfford(s.resources, cost)) return;
        set({
          resources: subtractCost(s.resources, cost),
          estate: { ...s.estate, mine: s.estate.mine + 1 },
        });
      },

      upgradeInn: () => {
        const s = get();
        const cap = getMaxBuildingLevel(s.estate.townHall ?? 1);
        if (s.estate.inn >= cap) return;
        const cost = upgradeCost("inn", s.estate.inn);
        if (!canAfford(s.resources, cost)) return;
        set({
          resources: subtractCost(s.resources, cost),
          estate: { ...s.estate, inn: s.estate.inn + 1 },
        });
      },

      upgradeTraining: () => {
        const s = get();
        const current = s.estate.training ?? 0;
        const cap = getMaxBuildingLevel(s.estate.townHall ?? 1);
        if (current >= cap) return;
        const cost = upgradeCost("training", current);
        if (!canAfford(s.resources, cost)) return;
        set({
          resources: subtractCost(s.resources, cost),
          estate: { ...s.estate, training: current + 1 },
        });
      },

      upgradeMonument: () => {
        const s = get();
        const current = s.estate.monument ?? 0;
        if (current >= MONUMENT_MAX_LEVEL) return;
        const cost = upgradeCost("monument", current);
        if (!canAfford(s.resources, cost)) return;
        set({
          resources: subtractCost(s.resources, cost),
          estate: { ...s.estate, monument: current + 1 },
        });
      },

      upgradeTownHall: () => {
        const s = get();
        const current = s.estate.townHall ?? 1;
        if (current >= TOWN_HALL_MAX) return;
        const cost = upgradeCost("townHall", current);
        if (!canAfford(s.resources, cost)) return;
        set({
          resources: subtractCost(s.resources, cost),
          estate: { ...s.estate, townHall: current + 1 },
        });
      },

      coopSummon: async (bossId) => {
        const s = get();
        const def = COOP_BOSSES[bossId];
        if (!def) return { ok: false, error: "unknown boss" };
        const itemCount = s.materials[def.summonItem] ?? 0;
        if (itemCount <= 0) return { ok: false, error: "소환 아이템 없음" };
        // Consume the summon item locally first
        const newMaterials = {
          ...s.materials,
          [def.summonItem]: itemCount - 1,
        };
        try {
          const res = await fetch("/api/coop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "summon",
              nickname: s.character.name,
              bossId,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { ok: false, error: data.error ?? "소환 실패" };
          }
          set({ materials: newMaterials });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "network error" };
        }
      },

      coopAttack: async (boss) => {
        const s = get();
        const def = COOP_BOSSES[boss.bossId];
        if (!def) return { ok: false, error: "unknown boss" };
        if (s.character.currentHp <= 0) return { ok: false, error: "HP가 부족합니다" };

        const monBonus = getMonumentBonus(s.estate.monument, s.stats.bossKillCounts);
        // 보스 현재 HP를 시뮬레이터에 전달 → 보스 사망 시 즉시 종료
        const result = simulateCoopAttack(
          s.character,
          { ...def, hp: boss.hp },
          COOP_ATTACK_TURNS,
          {},
          monBonus,
        );

        try {
          const res = await fetch("/api/coop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "attack",
              nickname: s.character.name,
              sessionId: boss.sessionId,
              damage: result.damageDealt,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            // Still apply HP loss even if server rejects (keep client consistent)
            const after = get();
            set({
              character: { ...after.character, currentHp: result.finalHp },
              hpUpdatedAt: Date.now(),
            });
            return { ok: false, error: data.error ?? "공격 실패" };
          }
          const data = (await res.json()) as { applied: number };
          // Apply HP loss
          const after = get();
          const characterMaxHp = computeStats(
            s.character,
            getMonumentBonus(s.estate.monument, s.stats.bossKillCounts),
          ).maxHp;
          const newBattle: LastBattle = {
            kind: "coop",
            at: Date.now(),
            bossName: def.name,
            bossMaxHp: def.hp,
            characterMaxHp,
            log: result.log,
            damageDealt: data.applied,
            damageTaken: result.damageTaken,
            diedEarly: result.diedEarly,
          };
          set({
            character: { ...after.character, currentHp: result.finalHp },
            hpUpdatedAt: Date.now(),
            lastBattles: [newBattle, ...(after.lastBattles ?? [])].slice(0, 3),
            lastCoopBattles: [newBattle, ...(after.lastCoopBattles ?? [])].slice(0, 3),
          });
          return {
            ok: true,
            damage: data.applied,
            damageTaken: result.damageTaken,
            diedEarly: result.diedEarly,
            log: result.log,
          };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "network error" };
        }
      },

      coopClaim: async (sessionId) => {
        const s = get();
        try {
          const res = await fetch("/api/coop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "claim",
              nickname: s.character.name,
              sessionId,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { ok: false, error: data.error ?? "수령 실패" };
          }
          const data = (await res.json()) as {
            reward: { gold: number; iron: number; materials: Materials };
            tier?: CoopRewardTier;
            damageRatio?: number;
            boss?: { bossId: string };
          };
          // Apply reward
          const after = get();
          const newMaterials: Materials = { ...after.materials };
          for (const [k, v] of Object.entries(data.reward.materials)) {
            if (!v) continue;
            newMaterials[k as keyof Materials] = (newMaterials[k as keyof Materials] ?? 0) + v;
          }
          const newResources = {
            gold: after.resources.gold + data.reward.gold,
            iron: after.resources.iron + data.reward.iron,
          };
          const coopBossName = data.boss ? COOP_BOSSES[data.boss.bossId]?.name : undefined;
          const newStats = statsAfterEvent(after.stats, {
            addCoopDefeat: 1,
            addBossKill: coopBossName,
            addGold: data.reward.gold,
            addIron: data.reward.iron,
          });
          const r = processClaims(
            {
              resources: newResources,
              materials: newMaterials,
              stats: newStats,
              achievements: after.achievements,
              claimedTiers: after.claimedTiers,
            },
            after._achievementToast,
          );
          set({
            resources: r.resources,
            materials: r.materials,
            stats: newStats,
            achievements: r.achievements,
            claimedTiers: r.claimedTiers,
            _achievementToast: r.toast,
          });
          return { ok: true, reward: data.reward, tier: data.tier, damageRatio: data.damageRatio };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "network error" };
        }
      },

      registerArena: async () => {
        const s = get();
        const nickname = s.character.name?.trim();
        if (!nickname) return { ok: false, error: "닉네임 필요" };
        const snapshot = buildArenaSnapshot(s.character, nickname);
        // Owner token — localStorage에 닉네임별로 저장된 ownerId 동봉. 없으면 null.
        // 서버는 (a) 신규 등록 → 새 ownerId 발급, (b) 기존 entry + 토큰 일치 → 갱신,
        // (c) 기존 entry + 토큰 불일치 → 409 squat 차단.
        const ownerKey = `arena_owner_${nickname}`;
        const ownerId = typeof window !== "undefined" ? localStorage.getItem(ownerKey) : null;
        try {
          const res = await fetch("/api/arena", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "register", snapshot, ownerId }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { ok: false, error: data.error ?? "등록 실패" };
          }
          const data = (await res.json().catch(() => ({}))) as { ownerId?: string };
          if (data.ownerId && typeof window !== "undefined") {
            localStorage.setItem(ownerKey, data.ownerId);
          }
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "network error" };
        }
      },

      fightArena: (opponent, tier) => {
        const s = get();
        if (s.character.currentHp <= 0) return { ok: false, error: "HP가 부족합니다" };
        const monBonus = getMonumentBonus(s.estate.monument, s.stats.bossKillCounts);
        const region = snapshotToRegion(opponent);
        const result = resolveBossDispatch(s.character, region, s.guild, monBonus);
        const characterMaxHp = computeStats(s.character, monBonus).maxHp;
        const newBattle: LastBattle = {
          at: Date.now(),
          kind: "arena",
          opponentNickname: opponent.nickname,
          opponentClassName: opponent.className,
          opponentLevel: opponent.level,
          opponentMaxHp: opponent.stats.maxHp,
          bossMaxHp: opponent.stats.maxHp,
          characterMaxHp,
          tier,
          result,
        };
        set({
          character: { ...s.character, currentHp: result.finalHp },
          hpUpdatedAt: Date.now(),
          lastBattles: [newBattle, ...(s.lastBattles ?? [])].slice(0, 3),
        });
        return { ok: true, result };
      },

      dismissAchievementToast: () => set({ _achievementToast: null }),
      dismissMilestoneToast: () => set({ _milestoneToast: null }),
      dismissUniqueDropToast: () => set({ _uniqueDropToast: null }),
      markAllNotificationsRead: () => {
        const s = get();
        const list = s.notifications ?? [];
        if (list.every((n) => n.read)) return;
        set({ notifications: list.map((n) => ({ ...n, read: true })) });
      },
      clearNotifications: () => set({ notifications: [] }),
      dismissTutorial: () => set({ tutorialDismissed: true }),
      dismissWelcome: () => set({ welcomeShown: true }),
      toggleCombatLog: () => set((s) => ({ combatLogEnabled: !s.combatLogEnabled })),
      toggleTheme: () => set((s) => ({ theme: (s.theme ?? "dark") === "dark" ? "light" : "dark" })),

      consumeAdminGrants: async () => {
        const s = get();
        const nickname = s.character.name?.trim();
        if (!nickname || nickname === "모험가") return { ok: false, consumed: 0, expGained: 0 };
        try {
          const res = await fetch("/api/admin/grant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "consume", nickname }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { ok: false, consumed: 0, expGained: 0, error: data.error ?? "consume 실패" };
          }
          const data = (await res.json()) as {
            grants: Array<{ id: string; exp: number; grantedAt: number }>;
          };
          const grants = data.grants ?? [];
          if (grants.length === 0) return { ok: true, consumed: 0, expGained: 0 };
          const totalExp = grants.reduce((sum, g) => sum + (g.exp ?? 0), 0);
          const after = get();
          const updated = applyExp(after.character, totalExp);
          const crossedMilestones = getCrossedMilestones(after.character.level, updated.level);
          const stats = statsAfterEvent(after.stats, { levelReached: updated.level });
          const r = processClaims(
            {
              resources: after.resources,
              materials: after.materials,
              stats,
              achievements: after.achievements,
              claimedTiers: after.claimedTiers,
            },
            after._achievementToast,
          );
          set({
            character: updated,
            stats,
            achievements: r.achievements,
            claimedTiers: r.claimedTiers,
            _achievementToast: r.toast,
            ...(crossedMilestones.length > 0
              ? { _milestoneToast: { level: crossedMilestones[crossedMilestones.length - 1] } }
              : {}),
          });
          return { ok: true, consumed: grants.length, expGained: totalExp };
        } catch (err) {
          return {
            ok: false,
            consumed: 0,
            expGained: 0,
            error: err instanceof Error ? err.message : "network error",
          };
        }
      },

      registerCodexMaterial: (id) => {
        const s = get();
        const codex = ensureCodex(s.character.codex);
        const currentCount = codex.materials.filter((m) => m === id).length;
        if (currentCount >= CODEX_MATERIAL_MAX_REGISTRATIONS) {
          return { ok: false, error: `최대 ${CODEX_MATERIAL_MAX_REGISTRATIONS}회까지만 등록 가능` };
        }
        const have = s.materials[id] ?? 0;
        if (have < CODEX_MATERIAL_COST) {
          return { ok: false, error: `${CODEX_MATERIAL_COST}개 필요 (보유 ${have})` };
        }
        const newMaterials: Materials = { ...s.materials, [id]: have - CODEX_MATERIAL_COST };
        const newCodex = { ...codex, materials: [...codex.materials, id] };
        set({
          materials: newMaterials,
          character: { ...s.character, codex: newCodex },
        });
        return { ok: true };
      },

      registerCodexEquipment: (id) => {
        // 자동 등록 시스템(획득 시 자동) 도입 후 — 본 메서드는 호환용 유지.
        // 인벤토리 차감 없이 codex에 추가만. UI에서 호출돼도 안전.
        const s = get();
        const codex = ensureCodex(s.character.codex);
        if (codex.equipment.includes(id)) {
          return { ok: false, error: "이미 등록된 장비입니다" };
        }
        const have = s.equipmentInventory[id] ?? 0;
        if (have <= 0) {
          return { ok: false, error: "보유 장비가 없습니다" };
        }
        const newCodex = { ...codex, equipment: [...codex.equipment, id] };
        set({
          character: { ...s.character, codex: newCodex },
        });
        return { ok: true };
      },

      allocateCodexPoint: (stat) => {
        const s = get();
        const codex = ensureCodex(s.character.codex);
        if (getCodexAvailablePoints(codex) < 1) {
          return { ok: false, error: "사용 가능 포인트 없음" };
        }
        const oldStats = computeStats(s.character);
        const hpPct = oldStats.maxHp > 0 ? s.character.currentHp / oldStats.maxHp : 1;
        const newAllocated = { ...codex.allocated, [stat]: (codex.allocated[stat] ?? 0) + 1 };
        const newCharacter = { ...s.character, codex: { ...codex, allocated: newAllocated } };
        const newStats = computeStats(newCharacter);
        set({
          character: { ...newCharacter, currentHp: Math.floor(newStats.maxHp * hpPct) },
          hpUpdatedAt: Date.now(),
        });
        return { ok: true };
      },

      unallocateCodexPoint: (stat) => {
        const s = get();
        const codex = ensureCodex(s.character.codex);
        const current = codex.allocated[stat] ?? 0;
        if (current <= 0) {
          return { ok: false, error: "할당된 포인트 없음" };
        }
        const oldStats = computeStats(s.character);
        const hpPct = oldStats.maxHp > 0 ? s.character.currentHp / oldStats.maxHp : 1;
        const newAllocated = { ...codex.allocated, [stat]: current - 1 };
        const newCharacter = { ...s.character, codex: { ...codex, allocated: newAllocated } };
        const newStats = computeStats(newCharacter);
        set({
          character: { ...newCharacter, currentHp: Math.floor(newStats.maxHp * hpPct) },
          hpUpdatedAt: Date.now(),
        });
        return { ok: true };
      },

      resetCodexAllocation: () => {
        const s = get();
        const codex = ensureCodex(s.character.codex);
        const oldStats = computeStats(s.character);
        const hpPct = oldStats.maxHp > 0 ? s.character.currentHp / oldStats.maxHp : 1;
        const newCharacter = { ...s.character, codex: { ...codex, allocated: {} } };
        const newStats = computeStats(newCharacter);
        set({
          character: { ...newCharacter, currentHp: Math.floor(newStats.maxHp * hpPct) },
          hpUpdatedAt: Date.now(),
        });
      },

      reset: () => set({ ...initialState(), _resolving: false, _achievementToast: null }),

      adminSetLevel: (level) => {
        const s = get();
        const lv = Math.max(1, Math.min(100, Math.floor(level)));
        const updated = { ...s.character, level: lv, exp: 0 };
        const newStats = computeStats(updated);
        set({
          character: { ...updated, currentHp: newStats.maxHp },
          stats: { ...s.stats, highestLevel: Math.max(s.stats.highestLevel, lv) },
          hpUpdatedAt: Date.now(),
        });
      },

      adminAddExp: (amount) => {
        const s = get();
        const next = applyExp(s.character, Math.max(0, Math.floor(amount)));
        const crossedMilestones = getCrossedMilestones(s.character.level, next.level);
        const stats = statsAfterEvent(s.stats, { levelReached: next.level });
        const r = processClaims(
          {
            resources: s.resources,
            materials: s.materials,
            stats,
            achievements: s.achievements,
            claimedTiers: s.claimedTiers,
          },
          null,
        );
        set({
          character: next,
          stats,
          achievements: r.achievements,
          claimedTiers: r.claimedTiers,
          ...(crossedMilestones.length > 0
            ? { _milestoneToast: { level: crossedMilestones[crossedMilestones.length - 1] } }
            : {}),
        });
      },

      adminAddSkillExp: (amount) => {
        const s = get();
        set({
          character: {
            ...s.character,
            skillExp: s.character.skillExp + Math.max(0, Math.floor(amount)),
          },
        });
      },

      adminAddResources: (gold, iron) => {
        const s = get();
        set({
          resources: {
            gold: s.resources.gold + Math.max(0, gold),
            iron: s.resources.iron + Math.max(0, iron),
          },
          stats: {
            ...s.stats,
            totalGoldEarned: s.stats.totalGoldEarned + Math.max(0, gold),
            totalIronEarned: s.stats.totalIronEarned + Math.max(0, iron),
          },
        });
      },

      adminAddMaterials: (mats) => {
        const s = get();
        set({ materials: addMaterials(s.materials, mats) });
      },

      adminSetBuilding: (slot, level) => {
        const s = get();
        const lv = Math.max(0, Math.floor(level));
        const cap =
          slot === "townHall" ? TOWN_HALL_MAX : getMaxBuildingLevel(s.estate.townHall ?? 1);
        const finalLv = Math.min(cap, lv);
        set({ estate: { ...s.estate, [slot]: finalLv } });
      },

      adminGiveAllEquipment: () => {
        const s = get();
        const inv = { ...s.equipmentInventory };
        for (const id of Object.keys(EQUIPMENT) as EquipmentId[]) {
          if ((inv[id] ?? 0) === 0) inv[id] = 1;
        }
        set({ equipmentInventory: inv });
      },

      adminEquipSet: (setId) => {
        const s = get();
        const inv = { ...s.equipmentInventory };
        const equipped: Partial<Record<EquipmentSlot, EquipmentId>> = { ...s.character.equipped };
        for (const id of Object.keys(EQUIPMENT) as EquipmentId[]) {
          const def = EQUIPMENT[id];
          if (def.setId === setId) {
            if ((inv[id] ?? 0) === 0) inv[id] = 1;
            equipped[def.slot] = id;
          }
        }
        const updated = { ...s.character, equipped };
        const newStats = computeStats(updated);
        set({
          equipmentInventory: inv,
          character: { ...updated, currentHp: newStats.maxHp },
          hpUpdatedAt: Date.now(),
        });
      },

      adminLearnAllAdvancedSkills: () => {
        const s = get();
        if (!s.character.advancedClass) return;
        const learned = getClassSkills(s.character.advancedClass).map((sk) => sk.id);
        set({ character: { ...s.character, learnedAdvancedSkills: learned } });
      },

      adminClaimAllAchievements: () => {
        const achievements: AchievementId[] = [];
        const claimedTiers: Partial<Record<AchievementId, number>> = {};
        for (const id of Object.keys(ACHIEVEMENTS) as AchievementId[]) {
          const a = ACHIEVEMENTS[id];
          if (a.kind === "single") achievements.push(id);
          else claimedTiers[id] = a.tiers.length;
        }
        set({ achievements, claimedTiers });
      },

      adminForceAdvance: (id) => {
        const s = get();
        // Lv 100 검증 우회를 위해 level 100으로 강제 후 advance
        const updated: typeof s.character = {
          ...s.character,
          level: Math.max(s.character.level, 100),
          advancedClass: id,
          learnedAdvancedSkills: [],
          equippedSkills: undefined,
        };
        const newStats = computeStats(updated);
        set({
          character: { ...updated, currentHp: newStats.maxHp },
          hpUpdatedAt: Date.now(),
        });
      },
    }),
    {
      // 새 게임(슬로우 RPG 모험 모드)으로 전환 — persist 키 변경으로 기존 v10 데이터 폐기.
      // 옛 localStorage 키("rpg-game-v10")는 브라우저에 남되 더는 읽히지 않음.
      name: "adventure-v1",
      version: 4,
      migrate: (persisted: unknown, version) => {
        const p = persisted as {
          character?: {
            name?: string;
            level?: number;
            learnedAdvancedSkills?: string[];
            equippedSkills?: string[];
            codex?: { allocated?: Record<string, number> };
            statPoints?: number;
            allocatedStats?: { str?: number; vit?: number; agi?: number; int?: number };
          };
          currentTownId?: string;
          unlockedTownIds?: string[];
        } | null;

        // adventure-v1: v1 → v2 — 모든 기존 캐릭터를 무직(none)으로 리셋.
        // 이름만 보존 (NamePromptModal 재노출 방지). 그 외 모두 초기 상태.
        if (p && version < 2) {
          const preservedName = p.character?.name ?? "모험가";
          const fresh = initialState();
          fresh.character.name = preservedName;
          return fresh as never;
        }

        // adventure-v1: v2 → v3 — 마을 시스템 추가. 기본값으로 평원 시드.
        if (p && version < 3) {
          if (!p.currentTownId) p.currentTownId = "plains";
          if (!p.unlockedTownIds || p.unlockedTownIds.length === 0) {
            p.unlockedTownIds = ["plains"];
          }
        }

        // adventure-v1: v3 → v4 — 레벨업 자유 분배 시스템 추가.
        // 기존 캐릭터엔 (level - 1) 만큼 미분배 포인트로 소급 지급.
        if (p && version < 4 && p.character) {
          const lvl = p.character.level ?? 1;
          if (p.character.statPoints === undefined) {
            p.character.statPoints = Math.max(0, lvl - 1);
          }
          if (!p.character.allocatedStats) {
            p.character.allocatedStats = { str: 0, vit: 0, agi: 0, int: 0 };
          }
        }

        // ── 아래는 옛 rpg-game-v10 시절의 잔재 마이그레이션 (adventure-v1 키엔 영향 없음).
        if (p && version < 2 && p.character) {
          // 방패병 스킬 ID 표시명에 맞춰 변경 + 수호의 맹세 → 반사
          // 화염구(fireball) → 마력구체(mana_orb) 패시브로 컨셉 변경
          const renames: Record<string, string> = {
            holy_light: "provoke",
            shield_of_resolve: "spike_aura",
            judgement: "counter_amp",
            martyrdom: "clutch_heal",
            guardian_oath: "reflect",
            fireball: "mana_orb",
          };
          const remap = (ids?: string[]) => ids?.map((id) => renames[id] ?? id);
          if (p.character.learnedAdvancedSkills) {
            p.character.learnedAdvancedSkills = remap(p.character.learnedAdvancedSkills);
          }
          if (p.character.equippedSkills) {
            p.character.equippedSkills = remap(p.character.equippedSkills);
          }
        }
        if (p && version < 3 && p.character?.codex?.allocated) {
          // 코덱스 atk/def/int → str/vit/matk 마이그레이션
          const a = p.character.codex.allocated;
          const next: Record<string, number> = { ...a };
          if (typeof a.atk === "number") {
            next.str = (next.str ?? 0) + a.atk;
            delete next.atk;
          }
          if (typeof a.def === "number") {
            next.vit = (next.vit ?? 0) + a.def;
            delete next.def;
          }
          if (typeof a.int === "number") {
            next.matk = (next.matk ?? 0) + a.int;
            delete next.int;
          }
          p.character.codex.allocated = next;
        }
        if (p && version < 3 && p.character) {
          // 원소술사 4종 ID 변경 (24 plan) — skillExp 보존, 슬롯/학습 목록 자동 매핑
          const elemRename: Record<string, string> = {
            flame_burst: "fire_element",
            ice_spike: "ice_element",
            lightning_chain: "lightning_element",
            meteor_descent: "elemental_combo",
          };
          const remapElem = (ids?: string[]) => ids?.map((id) => elemRename[id] ?? id);
          if (p.character.learnedAdvancedSkills) {
            p.character.learnedAdvancedSkills = remapElem(p.character.learnedAdvancedSkills);
          }
          if (p.character.equippedSkills) {
            p.character.equippedSkills = remapElem(p.character.equippedSkills);
          }
        }
        if (p && version < 4) {
          // 장비 자동 등록 도입 — 기존 보유 중인 장비 ID를 codex.equipment에 일괄 추가
          // 이미 등록된 ID는 중복 추가 안 함. 보유 0개 ID는 등록 안 됨 (의도적 — 한 번이라도 가졌으면 등록되도록 하려면 다른 추적 필요).
          const ps = p as unknown as {
            character?: { codex?: { equipment?: string[] } };
            equipmentInventory?: Record<string, number>;
          };
          const inv = ps.equipmentInventory ?? {};
          if (ps.character) {
            if (!ps.character.codex) ps.character.codex = { equipment: [] };
            if (!ps.character.codex.equipment) ps.character.codex.equipment = [];
            const registered = new Set(ps.character.codex.equipment);
            for (const [id, count] of Object.entries(inv)) {
              if ((count ?? 0) > 0 && !registered.has(id)) {
                ps.character.codex.equipment.push(id);
                registered.add(id);
              }
            }
          }
        }
        return p as never;
      },
      partialize: (s) => ({
        character: s.character,
        resources: s.resources,
        materials: s.materials,
        claimedTiers: s.claimedTiers,
        tutorialDismissed: s.tutorialDismissed,
        welcomeShown: s.welcomeShown,
        combatLogEnabled: s.combatLogEnabled,
        theme: s.theme,
        crafted: s.crafted,
        equipmentInventory: s.equipmentInventory,
        estate: s.estate,
        guild: s.guild,
        dispatch: s.dispatch,
        log: s.log,
        hpUpdatedAt: s.hpUpdatedAt,
        bossCooldowns: s.bossCooldowns,
        lastSeenAt: s.lastSeenAt,
        stats: s.stats,
        achievements: s.achievements,
        lastBattles: s.lastBattles,
        notifications: s.notifications,
      }),
    },
  ),
);
