// 오프라인 사냥 서버 lib — claim 트랜잭션의 핵심 로직.
//
// 클라이언트 옵티미스틱 sim → PATCH 방식이 PATCH 실패 시 보상 손실을 일으켜
// (audit-findings #2), 서버를 source-of-truth 로 전환. /api/offline-hunt/{start,claim,end}
// 가 이 모듈을 사용해 baseline 부터 NOW 까지의 시뮬을 트랜잭션 안에서 한 번에 처리한다.

import { and, eq } from "drizzle-orm";
import { savesKv, users } from "@/db/schema";
import { upsertSave, type DbExecutor } from "@/lib/server/savesKv";
import {
  simulateOfflineHunt,
  type OfflineSimInput,
  type OfflineSimResult,
} from "@/adventure/battle/offlineSim";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { baseCharacter, maxHpForLevel } from "@/adventure/character/defaults";
import { derivePlayerCombat } from "@/adventure/character/derivePlayerCombat";
import { applyExpGain } from "@/lib/leveling";
import { ITEMS, findItemId, type EquipItem } from "@/adventure/data/items";
import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import { WORLD_MAP, START_REGION_ID, type RegionId } from "@/adventure/data/world";
import type { PotionId } from "@/adventure/data/potions";
// type-only — useAutoPotionConfig 자체는 "use client" 지만 type 임포트는 erase 됨.
import type { AutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";

// pickAutoAction 의 hp_heal 룰 기본값 — 클라가 룰을 안 보내거나 비활성일 때 사용.
const DEFAULT_AUTO_POTION_RULES: AutoPotionConfig["rules"] = [];

// engine/useBattle 의 PLAYER_TURN_INTERVAL_MS 와 동일 (useBattle 은 "use client" 라 import 불가 → 인라인).
const PLAYER_TURN_INTERVAL_MS = 250;

// awayMs 이 이 값 미만이면 sim 안 돌리고 noop — 짧은 alt-tab 의 라운드트립 낭비 방지.
export const CLAIM_MIN_AWAY_MS = 10_000;

// xmur3 + mulberry32 — 결정적 PRNG. seed = hash(userId, baselineMs).
// HTTP 응답 손실 후 같은 baseline 으로 재시도해도 같은 결과 나오도록 결정성 확보.
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function makeRng(userId: string, baselineMs: number): () => number {
  const seedFn = xmur3(`${userId}:${baselineMs}`);
  let a = seedFn();
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// savesKv 에서 sim 입력 조립.
type SavedCharacter = {
  hp?: number;
  level?: number;
  exp?: number;
  gold?: number;
  stats?: Partial<Record<StatKey, number>>;
  equipped?: {
    weapon?: EquipItem | null;
    armor?: EquipItem | null;
    accessory?: EquipItem | null;
  } | null;
  equippedSkills?: string[];
  [k: string]: unknown;
};

type SavedTraining = { allocated?: Partial<Record<StatKey, number>> };

type SavedInventory = {
  potions?: Partial<Record<PotionId, number>>;
  materials?: Record<string, number>;
  equipment?: Record<string, number>;
  [k: string]: unknown;
};

type SavedCrafting = {
  known?: string[];
  shareable?: unknown;
  [k: string]: unknown;
};

type SavedMap = {
  currentRegionId?: RegionId;
  visitedRegionIds?: RegionId[];
  respawnRegionId?: RegionId;
};

function rehydrateEquip(saved: EquipItem | null | undefined): EquipItem | null {
  if (!saved) return null;
  const id = findItemId(saved);
  return id ? ITEMS[id] : null;
}

async function readKv<T>(
  tx: DbExecutor,
  userId: string,
  key: string,
  lock: boolean,
): Promise<T | null> {
  const q = tx
    .select()
    .from(savesKv)
    .where(and(eq(savesKv.userId, userId), eq(savesKv.key, key)));
  const rows = lock ? await q.for("update") : await q.limit(1);
  return (rows[0]?.value as T | undefined) ?? null;
}

export type LoadedState = {
  character: SavedCharacter;
  inventory: SavedInventory;
  crafting: SavedCrafting;
  map: SavedMap;
  training: SavedTraining;
};

// 트랜잭션 안에서 sim 에 필요한 모든 savesKv 키를 잠금 + 읽음.
// character/inventory/crafting 은 결과 반영 대상이라 for update, map/training 은 read-only.
export async function loadStateForSim(
  tx: DbExecutor,
  userId: string,
): Promise<LoadedState | null> {
  const character = await readKv<SavedCharacter>(tx, userId, "character.v2", true);
  if (!character) return null;
  const inventory =
    (await readKv<SavedInventory>(tx, userId, "inventory.v2", true)) ?? {};
  const crafting =
    (await readKv<SavedCrafting>(tx, userId, "crafting.v2", true)) ?? {};
  const map = (await readKv<SavedMap>(tx, userId, "map.v2", false)) ?? {};
  const training =
    (await readKv<SavedTraining>(tx, userId, "training.v2", false)) ?? {};
  return { character, inventory, crafting, map, training };
}

// sim 입력 조립 — derivePlayerCombat 으로 PlayerCombat 만들고 region/potions/luk 등 패키징.
export type AssembleSimInputOpts = {
  state: LoadedState;
  baselineHp: number;
  baselineRegionId: RegionId;
  awayMs: number;
  rng: () => number;
  autoPotionRules: AutoPotionConfig["rules"];
  playerName: string;
};

export function assembleSimInput(opts: AssembleSimInputOpts): OfflineSimInput {
  const { state, baselineHp, baselineRegionId, awayMs, rng, autoPotionRules } =
    opts;
  const character = state.character;

  const allocatedStats: Record<StatKey, number> = STAT_KEYS.reduce(
    (acc, k) => {
      acc[k] = state.training.allocated?.[k] ?? 0;
      return acc;
    },
    { str: 0, dex: 0, vit: 0, spd: 0, luk: 0 } as Record<StatKey, number>,
  );

  const equipped = {
    weapon: rehydrateEquip(character.equipped?.weapon),
    armor: rehydrateEquip(character.equipped?.armor),
    accessory: rehydrateEquip(character.equipped?.accessory),
  };

  const derived = derivePlayerCombat({
    level: character.level ?? 1,
    baseStats: baseCharacter.stats,
    allocatedStats,
    equipped,
    equippedSkills: character.equippedSkills,
    hp: baselineHp,
  });

  const region =
    WORLD_MAP.regions.find((r) => r.id === baselineRegionId) ??
    WORLD_MAP.regions.find((r) => r.id === START_REGION_ID)!;

  const potions = state.inventory.potions ?? {};
  const knownSet = new Set(state.crafting.known ?? []);

  return {
    player: { ...derived.player, hp: baselineHp },
    playerName: opts.playerName,
    region,
    playerLevel: character.level ?? 1,
    playerExp: character.exp ?? 0,
    potions,
    turnIntervalMs: PLAYER_TURN_INTERVAL_MS,
    awayMs,
    luk: derived.totalStats.luk,
    knowsRecipe: (id) => knownSet.has(id),
    pickAction: (battleState) =>
      pickAutoAction(battleState, {
        rules: autoPotionRules ?? DEFAULT_AUTO_POTION_RULES,
        potions,
      }),
    rng,
  };
}

// sim 결과를 savesKv 의 character/inventory/crafting 에 반영.
// 클라 onApply (page.tsx) 와 동일 순서로:
//   1) 인벤토리 — 포션 차감 + 재료/장비/제작서 추가
//   2) 캐릭터 — gold/exp/level/hp (사망 시 hp=0+respawn region)
// 트랜잭션 안에서 호출되므로 부분 실패 없음.
export type ApplyResultOpts = {
  state: LoadedState;
  result: OfflineSimResult;
  died: boolean;
};

export type ApplyResultOutcome = {
  newCharacter: SavedCharacter;
  newInventory: SavedInventory;
  newCrafting: SavedCrafting;
  newRespawnRegionId: RegionId | null;
};

export async function applyResultToSaves(
  tx: DbExecutor,
  userId: string,
  { state, result, died }: ApplyResultOpts,
): Promise<ApplyResultOutcome> {
  // 인벤토리 갱신.
  const inv = { ...state.inventory };
  const potions = { ...(inv.potions ?? {}) } as Record<string, number>;
  for (const [id, n] of Object.entries(result.potionsConsumed)) {
    if (!n) continue;
    potions[id] = Math.max(0, (potions[id] ?? 0) - n);
  }
  const materials = { ...(inv.materials ?? {}) } as Record<string, number>;
  for (const [id, n] of Object.entries(result.materialsGained)) {
    if (!n) continue;
    materials[id] = (materials[id] ?? 0) + n;
  }
  const equipment = { ...(inv.equipment ?? {}) } as Record<string, number>;
  for (const itemId of result.equipsGained) {
    equipment[itemId] = (equipment[itemId] ?? 0) + 1;
  }
  const newInventory: SavedInventory = {
    ...inv,
    potions,
    materials,
    equipment,
  };

  // 제작서 학습 — sim 단계에서 미보유만 골라낸 상태라 중복 가드 1번 더 (안전망).
  const knownArr = Array.isArray(state.crafting.known)
    ? [...(state.crafting.known as string[])]
    : [];
  const knownSet = new Set(knownArr);
  for (const rid of result.recipesLearned) {
    if (!knownSet.has(rid)) {
      knownArr.push(rid);
      knownSet.add(rid);
    }
  }
  const newCrafting: SavedCrafting = { ...state.crafting, known: knownArr };

  // 캐릭터 — gold/exp/level/hp.
  // useCharacterState.addExp 의 동작:
  //   - applyExpGain 으로 누적 EXP → 새 레벨 도달 시 hp = maxHpForLevel(level) + vitHpBonus
  // 서버 sim 은 simulateOfflineHunt 가 이미 누적 EXP/레벨 추적해 result.expGained 만 반환.
  // 여기서 다시 applyExpGain 호출하지 않고 character.level/exp 를 직접 갱신.
  // VIT 보너스 풀회복은 sim 중간에 일어난 레벨업이면 finalPlayerHp 가 이미 그 후 HP.
  // 단 사망(died) 면 hp=0, 살았으면 max(currentHp, finalPlayerHp) — 마을 회복 등 외부 보존.
  // (참고: applyExpGain 은 sim 내부에서 호출됨. 여기서 재호출하면 이중 적용 위험.)
  const character = state.character;
  const newLevelExp = computeFinalLevelExp(
    character.level ?? 1,
    character.exp ?? 0,
    result.expGained,
  );
  const respawnId = state.map.respawnRegionId ?? START_REGION_ID;
  const baseHp = character.hp ?? baseCharacter.hp;
  let newHp: number;
  if (died) {
    newHp = 0;
  } else if (newLevelExp.levelsGained > 0) {
    // 레벨업 발생 — VIT 보너스만큼 풀회복 (useCharacterState.addExp 와 동일).
    const vit = derivePlayerCombat({
      level: newLevelExp.level,
      baseStats: baseCharacter.stats,
      allocatedStats: STAT_KEYS.reduce(
        (acc, k) => {
          acc[k] = state.training.allocated?.[k] ?? 0;
          return acc;
        },
        { str: 0, dex: 0, vit: 0, spd: 0, luk: 0 } as Record<StatKey, number>,
      ),
      equipped: {
        weapon: rehydrateEquip(character.equipped?.weapon),
        armor: rehydrateEquip(character.equipped?.armor),
        accessory: rehydrateEquip(character.equipped?.accessory),
      },
      equippedSkills: character.equippedSkills,
      hp: result.finalPlayerHp,
    }).totalStats.vit;
    newHp = maxHpForLevel(newLevelExp.level) + vit * 2;
  } else {
    newHp = Math.max(baseHp, result.finalPlayerHp);
  }

  const newCharacter: SavedCharacter = {
    ...character,
    gold: (character.gold ?? 0) + result.goldGained,
    level: newLevelExp.level,
    exp: newLevelExp.exp,
    hp: newHp,
  };

  // savesKv 쓰기 — version++.
  await upsertSave(tx, userId, "character.v2", newCharacter);
  await upsertSave(tx, userId, "inventory.v2", newInventory);
  if (result.recipesLearned.length > 0) {
    await upsertSave(tx, userId, "crafting.v2", newCrafting);
  }

  // 사망 시 map.v2 의 currentRegionId 도 respawn 으로 갱신 (클라 onApply 가 하던 동작).
  let newRespawnRegionId: RegionId | null = null;
  if (died) {
    const mapValue = state.map;
    const visited = mapValue.visitedRegionIds ?? [START_REGION_ID];
    const nextMap = {
      ...mapValue,
      currentRegionId: respawnId,
      visitedRegionIds: visited.includes(respawnId)
        ? visited
        : [...visited, respawnId],
    };
    await upsertSave(tx, userId, "map.v2", nextMap);
    newRespawnRegionId = respawnId;
  }

  return { newCharacter, newInventory, newCrafting, newRespawnRegionId };
}

// 사이클 중 누적 EXP 로 레벨업 처리. simulateOfflineHunt 가 내부에서 같은 함수를 호출하지만
// 여기서는 (character.exp, result.expGained) 을 다시 합쳐 최종 상태 계산.
// 주의: simulateOfflineHunt 는 result.expGained 만 반환하고 누적 레벨업은 내부 추적만 한다.
// 따라서 결과를 character 에 반영할 때 한 번 더 applyExpGain 을 돌려 동일 결과 도출.
function computeFinalLevelExp(
  level: number,
  exp: number,
  gained: number,
): { level: number; exp: number; levelsGained: number } {
  if (gained <= 0) return { level, exp, levelsGained: 0 };
  return applyExpGain(level, exp, gained);
}

// users 의 baseline 컬럼 갱신 — start/claim/end 가 공유.
export type BaselineUpdate = {
  huntActive?: boolean;
  huntRegion?: string | null;
  huntBaselineHp?: number | null;
  huntBaselineAt?: Date | null;
  lastClaimId?: string | null;
  lastClaimResult?: OfflineSimResult | null;
};

export async function updateBaseline(
  tx: DbExecutor,
  userId: string,
  patch: BaselineUpdate,
): Promise<void> {
  // drizzle update 에 부분 컬럼만 set — undefined 키는 SQL 에 포함 안 됨.
  const set: Record<string, unknown> = {};
  if (patch.huntActive !== undefined) set.huntActive = patch.huntActive;
  if (patch.huntRegion !== undefined) set.huntRegion = patch.huntRegion;
  if (patch.huntBaselineHp !== undefined)
    set.huntBaselineHp = patch.huntBaselineHp;
  if (patch.huntBaselineAt !== undefined)
    set.huntBaselineAt = patch.huntBaselineAt;
  if (patch.lastClaimId !== undefined) set.lastClaimId = patch.lastClaimId;
  if (patch.lastClaimResult !== undefined)
    set.lastClaimResult = patch.lastClaimResult;
  if (Object.keys(set).length === 0) return;
  await tx.update(users).set(set).where(eq(users.id, userId));
}

// run 결과 — claim/end 가 공통으로 반환.
export type RunOutcome = {
  result: OfflineSimResult | null; // null = sim 안 돈 noop
  hadReward: boolean;
};

export function hasMeaningfulResult(result: OfflineSimResult): boolean {
  return result.battles > 0 || result.died;
}
