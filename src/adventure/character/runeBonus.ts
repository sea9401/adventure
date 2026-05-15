import {
  getRuneMagnitude,
  RUNES,
  type EquippedRune,
  type RuneEffectKind,
} from "@/adventure/data/runes";

// 장착된 룬 3슬롯 → 효과 종류별 % 합산.
// 같은 effect 종(예: ATK%) 룬을 여러 슬롯에 끼면 합산된다.
// null 슬롯은 무시. 가산형 7종 전부 동일한 합산 규칙.

export type RuneBonusMap = Record<RuneEffectKind, number>;

const EMPTY_BONUS: RuneBonusMap = {
  atk_pct: 0,
  def_pct: 0,
  hp_pct: 0,
  crit_pct: 0,
  exp_pct: 0,
  drop_pct: 0,
  potion_pct: 0,
  counter_pct: 0,
  lifesteal_pct: 0,
  regen_pct: 0,
};

export function emptyRuneBonus(): RuneBonusMap {
  return { ...EMPTY_BONUS };
}

export function computeRuneBonus(
  equipped: ReadonlyArray<EquippedRune | null> | undefined,
): RuneBonusMap {
  const out: RuneBonusMap = emptyRuneBonus();
  if (!equipped) return out;
  for (const r of equipped) {
    if (!r) continue;
    const def = RUNES[r.id];
    if (!def) continue;
    out[def.effect] += getRuneMagnitude(r.id, r.grade);
  }
  return out;
}

/** % 가산값을 배수로 — 예: 12 → 1.12 */
export function pctToMultiplier(pct: number): number {
  return 1 + pct / 100;
}
