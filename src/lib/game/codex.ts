import type { CodexState, CodexStatKey } from "./types";

export const CODEX_ENTRIES_PER_POINT = 5;
export const CODEX_MATERIAL_COST = 10;
// 장비는 획득 시 자동 등록 (소모 없음). 호환을 위해 0으로 유지.
export const CODEX_EQUIPMENT_COST = 0;
export const CODEX_MATERIAL_MAX_REGISTRATIONS = 3;
// 포인트당 스탯 보너스. SPD는 1점당 +5% 추가공격이라 무게가 커서 1/5로 책정.
// STR/VIT/MATK는 ATK/DEF/INT의 primary attribute 역할 (각각 +1 ATK/DEF/INT 환산).
export const CODEX_STAT_PER_POINT: Record<CodexStatKey, number> = {
  hp: 100,
  str: 10,
  vit: 10,
  mdef: 10,
  spd: 0.2,
  agi: 1,
  matk: 10,
};

export const getCodexEntries = (codex: CodexState | undefined): number =>
  (codex?.materials.length ?? 0) + (codex?.equipment.length ?? 0);

export const getCodexEarnedPoints = (codex: CodexState | undefined): number =>
  Math.floor(getCodexEntries(codex) / CODEX_ENTRIES_PER_POINT);

export const getCodexAllocatedPoints = (codex: CodexState | undefined): number => {
  const a = codex?.allocated;
  if (!a) return 0;
  let sum = 0;
  for (const v of Object.values(a)) sum += v ?? 0;
  return sum;
};

export const getCodexAvailablePoints = (codex: CodexState | undefined): number =>
  Math.max(0, getCodexEarnedPoints(codex) - getCodexAllocatedPoints(codex));

export const getCodexBonus = (codex: CodexState | undefined): Record<CodexStatKey, number> => {
  const a = codex?.allocated ?? {};
  return {
    hp: Math.floor((a.hp ?? 0) * CODEX_STAT_PER_POINT.hp),
    str: Math.floor((a.str ?? 0) * CODEX_STAT_PER_POINT.str),
    vit: Math.floor((a.vit ?? 0) * CODEX_STAT_PER_POINT.vit),
    mdef: Math.floor((a.mdef ?? 0) * CODEX_STAT_PER_POINT.mdef),
    spd: Math.floor((a.spd ?? 0) * CODEX_STAT_PER_POINT.spd),
    agi: Math.floor((a.agi ?? 0) * CODEX_STAT_PER_POINT.agi),
    matk: Math.floor((a.matk ?? 0) * CODEX_STAT_PER_POINT.matk),
  };
};

export const ensureCodex = (codex: CodexState | undefined): CodexState => ({
  materials: codex?.materials ?? [],
  equipment: codex?.equipment ?? [],
  allocated: codex?.allocated ?? {},
});
