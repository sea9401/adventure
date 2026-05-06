import type { EquipmentBonus, EquippedItems, SetId } from "./types";
import { EQUIPMENT, SETS } from "./data";

export const getEquipmentBonuses = (equipped?: EquippedItems): EquipmentBonus => {
  if (!equipped) return {};
  const out: EquipmentBonus = {};
  for (const slot of Object.keys(equipped) as (keyof EquippedItems)[]) {
    const id = equipped[slot];
    if (!id) continue;
    const def = EQUIPMENT[id];
    if (!def) continue;
    for (const [k, v] of Object.entries(def.bonus)) {
      const key = k as keyof EquipmentBonus;
      out[key] = (out[key] ?? 0) + (v ?? 0);
    }
  }
  return out;
};

// 장비 + 세트 보너스의 크리티컬 합산 (0~1, e.g., 0.05 = +5%)
export const getEquipmentCritBonus = (equipped?: EquippedItems): number => {
  const eq = getEquipmentBonuses(equipped);
  const setB = getSetBonuses(equipped);
  return (eq.crit ?? 0) + (setB.crit ?? 0);
};

// 장비 + 세트 보너스의 DOT 증폭 합산 (0~1, dot_aura passive와 가산)
export const getEquipmentDotAmp = (equipped?: EquippedItems): number => {
  const eq = getEquipmentBonuses(equipped);
  const setB = getSetBonuses(equipped);
  return (eq.dotAmp ?? 0) + (setB.dotAmp ?? 0);
};

export const getSetCounts = (equipped?: EquippedItems): Partial<Record<SetId, number>> => {
  const counts: Partial<Record<SetId, number>> = {};
  if (!equipped) return counts;
  for (const slot of Object.keys(equipped) as (keyof EquippedItems)[]) {
    const id = equipped[slot];
    if (!id) continue;
    const def = EQUIPMENT[id];
    if (!def?.setId) continue;
    counts[def.setId] = (counts[def.setId] ?? 0) + 1;
  }
  return counts;
};

export const getSetBonuses = (equipped?: EquippedItems): EquipmentBonus => {
  const counts = getSetCounts(equipped);
  const out: EquipmentBonus = {};
  for (const [setId, count] of Object.entries(counts)) {
    const set = SETS[setId as SetId];
    if (!set || !count) continue;
    for (const tier of set.tiers) {
      if (count >= tier.count) {
        for (const [k, v] of Object.entries(tier.bonus)) {
          const key = k as keyof EquipmentBonus;
          out[key] = (out[key] ?? 0) + (v ?? 0);
        }
      }
    }
  }
  return out;
};
