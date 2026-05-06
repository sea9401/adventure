import type { ArenaSnapshot, Boss, Character, EquippedItems, Region, Stats } from "./types";
import { EQUIPMENT } from "./data";
import { computeStats, getActiveClassName, getActivePassive, getEquippedSkills } from "./logic";

export const ARENA_MIN_LEVEL = 30;
export const ARENA_MIN_NICKNAME_LEN = 1;
export const ARENA_MAX_NICKNAME_LEN = 20;

export const computeArenaPower = (stats: Stats, level: number): number =>
  Math.floor(
    stats.maxHp / 10 +
      stats.atk * 2 +
      stats.def +
      stats.mdef +
      stats.spd +
      stats.agi +
      stats.int +
      level * 5,
  );

// 등록 시점의 최종 전투 stats — equipped skill의 flat/pct 패시브 + speed_aura 클래스 패시브 반영
export const computeFinalStatsForArena = (c: Character): Stats => {
  const base = computeStats(c);
  let flatAtk = 0,
    flatDef = 0,
    flatMdef = 0,
    flatSpd = 0,
    flatAgi = 0,
    flatInt = 0,
    flatHp = 0;
  let pctAtk = 0,
    pctDef = 0,
    pctMdef = 0,
    pctSpd = 0,
    pctAgi = 0,
    pctInt = 0,
    pctHp = 0;

  for (const s of getEquippedSkills(c)) {
    if (s.trigger.kind !== "passive") continue;
    if (s.effect.kind === "flat_stat") {
      flatAtk += s.effect.atk ?? 0;
      flatDef += s.effect.def ?? 0;
      flatMdef += s.effect.mdef ?? 0;
      flatSpd += s.effect.spd ?? 0;
      flatAgi += s.effect.agi ?? 0;
      flatInt += s.effect.int ?? 0;
      flatHp += s.effect.hp ?? 0;
    }
    if (s.effect.kind === "stat_pct_boost") {
      pctAtk += s.effect.atkPct ?? 0;
      pctDef += s.effect.defPct ?? 0;
      pctMdef += s.effect.mdefPct ?? 0;
      pctSpd += s.effect.spdPct ?? 0;
      pctAgi += s.effect.agiPct ?? 0;
      pctInt += s.effect.intPct ?? 0;
      pctHp += s.effect.hpPct ?? 0;
    }
  }

  const passive = getActivePassive(c);
  if (passive.kind === "speed_aura") flatSpd += passive.spdSelfBonus;

  const out: Stats = {
    maxHp: base.maxHp + flatHp,
    atk: base.atk + flatAtk,
    def: base.def + flatDef,
    mdef: base.mdef + flatMdef,
    spd: base.spd + flatSpd,
    agi: base.agi + flatAgi,
    int: base.int + flatInt,
    str: base.str ?? 0,
    vit: base.vit ?? 0,
    matk: base.matk ?? 0,
  };
  if (pctAtk) out.atk = Math.floor(out.atk * (1 + pctAtk));
  if (pctDef) out.def = Math.floor(out.def * (1 + pctDef));
  if (pctMdef) out.mdef = Math.floor(out.mdef * (1 + pctMdef));
  if (pctSpd) out.spd = Math.floor(out.spd * (1 + pctSpd));
  if (pctAgi) out.agi = Math.floor(out.agi * (1 + pctAgi));
  if (pctInt) out.int = Math.floor(out.int * (1 + pctInt));
  if (pctHp) out.maxHp = Math.floor(out.maxHp * (1 + pctHp));
  return out;
};

export const buildArenaSnapshot = (c: Character, nickname: string): ArenaSnapshot => {
  const stats = computeFinalStatsForArena(c);
  const equipped: EquippedItems = c.equipped ?? {};
  const equippedItemNames: string[] = [];
  for (const slot of Object.keys(equipped) as (keyof EquippedItems)[]) {
    const id = equipped[slot];
    if (!id) continue;
    const def = EQUIPMENT[id];
    if (def) equippedItemNames.push(def.name);
  }
  return {
    nickname: nickname.trim().slice(0, ARENA_MAX_NICKNAME_LEN),
    level: c.level,
    className: getActiveClassName(c),
    stats,
    power: computeArenaPower(stats, c.level),
    equippedSkillNames: getEquippedSkills(c).map((s) => s.name),
    equippedItemNames,
    registeredAt: Date.now(),
  };
};

// 더미 → 합성 보스. 보스 스킬 없음 (스탯만)
export const snapshotToBoss = (snap: ArenaSnapshot): Boss => ({
  name: `${snap.nickname}의 빌드`,
  hp: snap.stats.maxHp,
  atk: snap.stats.atk,
  def: snap.stats.def,
  mdef: snap.stats.mdef,
  spd: snap.stats.spd,
  agi: snap.stats.agi,
  int: snap.stats.int,
  drop: "slime_jelly",
  scrollDrop: { id: "slime_jelly", chance: 0 },
  flavor: `${snap.className} · Lv.${snap.level}`,
});

// resolveBossDispatch가 Region을 받으므로 빈 region에 보스 끼움
export const snapshotToRegion = (snap: ArenaSnapshot): Region => ({
  id: `arena:${snap.nickname}`,
  name: "아레나",
  group: "outskirts",
  durationMs: 0,
  drops: {},
  expReward: 0,
  flavor: "",
  enemies: [],
  boss: snapshotToBoss(snap),
});

// 검투장 챔피언 — 항상 노출되는 강한 NPC 도전자 (Lv 110, 기존 강 티어 위)
export const ARENA_NPC: ArenaSnapshot = (() => {
  const stats: Stats = {
    maxHp: 3500,
    atk: 180,
    def: 125,
    mdef: 80,
    spd: 48,
    agi: 38,
    int: 32,
    str: 0,
    vit: 0,
    matk: 0,
  };
  return {
    nickname: "검투장 챔피언",
    level: 110,
    className: "전설의 검투사",
    stats,
    power: computeArenaPower(stats, 110),
    equippedSkillNames: ["철벽", "광격", "천둥 강타", "분노", "초재생"],
    equippedItemNames: ["수호자 대방패", "수호자 중갑", "수호자 검", "유령 투구", "유령 신발"],
    registeredAt: 0,
  };
})();

// 풀에서 NPC 1명 + 랜덤 등록 상대 1명
export const pickOpponents = (
  pool: ArenaSnapshot[],
  excludeNickname?: string,
): { npc: ArenaSnapshot; random: ArenaSnapshot | null } => {
  const filtered = (
    excludeNickname ? pool.filter((s) => s.nickname !== excludeNickname) : pool
  ).filter((s) => s.nickname !== ARENA_NPC.nickname);
  const random =
    filtered.length === 0 ? null : filtered[Math.floor(Math.random() * filtered.length)];
  return { npc: ARENA_NPC, random };
};

// 콜드 스타트용 시드 — 풀과 합쳐 항상 노출
export const ARENA_SEEDS: ArenaSnapshot[] = [
  {
    nickname: "초보 도적",
    level: 32,
    className: "도적",
    stats: {
      maxHp: 540,
      atk: 38,
      def: 16,
      mdef: 14,
      spd: 28,
      agi: 26,
      int: 12,
      str: 0,
      vit: 0,
      matk: 0,
    },
    power: 0,
    equippedSkillNames: ["회피 자세", "그림자 일격"],
    equippedItemNames: ["가죽 갑옷", "쥐가죽 부츠"],
    registeredAt: 0,
  },
  {
    nickname: "광부 견습 마법사",
    level: 38,
    className: "마법사",
    stats: {
      maxHp: 480,
      atk: 22,
      def: 14,
      mdef: 30,
      spd: 22,
      agi: 18,
      int: 44,
      str: 0,
      vit: 0,
      matk: 0,
    },
    power: 0,
    equippedSkillNames: ["파이어볼", "마력 친화"],
    equippedItemNames: ["수정 갑옷", "광부 부츠"],
    registeredAt: 0,
  },
  {
    nickname: "베테랑 전사",
    level: 65,
    className: "전사",
    stats: {
      maxHp: 1320,
      atk: 78,
      def: 56,
      mdef: 28,
      spd: 30,
      agi: 22,
      int: 14,
      str: 0,
      vit: 0,
      matk: 0,
    },
    power: 0,
    equippedSkillNames: ["방패 강타", "철벽", "광폭화"],
    equippedItemNames: ["수호자 투구", "수호자 갑판", "수호자 검"],
    registeredAt: 0,
  },
  {
    nickname: "독무 사도",
    level: 88,
    className: "맹독술사",
    stats: {
      maxHp: 1480,
      atk: 62,
      def: 38,
      mdef: 52,
      spd: 44,
      agi: 38,
      int: 88,
      str: 0,
      vit: 0,
      matk: 0,
    },
    power: 0,
    equippedSkillNames: ["독액 살포", "죽음의 안개", "맹독 폭발", "부패의 손길"],
    equippedItemNames: ["거미 여왕 로브", "송곳니 장갑", "거미실 독니검"],
    registeredAt: 0,
  },
  {
    nickname: "수호기사단장",
    level: 95,
    className: "수호기사",
    stats: {
      maxHp: 2100,
      atk: 92,
      def: 88,
      mdef: 56,
      spd: 36,
      agi: 28,
      int: 22,
      str: 0,
      vit: 0,
      matk: 0,
    },
    power: 0,
    equippedSkillNames: ["철벽", "방패 강타", "가시 오라", "결의의 방패"],
    equippedItemNames: ["수호자 투구", "수호자 대방패", "수호자 중갑", "수호자 검"],
    registeredAt: 0,
  },
].map((s) => ({ ...s, power: computeArenaPower(s.stats, s.level) }));
