import type { EquipmentDef, SetDef, SetId } from "../types";

export const SETS: Record<SetId, SetDef> = {
  plains_set: {
    id: "plains_set",
    name: "평야 세트",
    totalPieces: 2,
    tiers: [{ count: 2, bonus: { hp: 15 } }],
  },
  forest_set: {
    id: "forest_set",
    name: "가죽 세트",
    totalPieces: 4,
    tiers: [
      { count: 2, bonus: { hp: 20 } },
      { count: 3, bonus: { atk: 2 } },
      { count: 4, bonus: { agi: 2 } },
    ],
  },
  cave_set: {
    id: "cave_set",
    name: "동굴 세트",
    totalPieces: 4,
    tiers: [
      { count: 2, bonus: { int: 5 } },
      { count: 4, bonus: { int: 8, mdef: 5 } },
    ],
  },
  ruins_set: {
    id: "ruins_set",
    name: "낡은 유적 세트",
    totalPieces: 5,
    tiers: [
      { count: 2, bonus: { def: 8 } },
      { count: 3, bonus: { hp: 55 } },
      { count: 4, bonus: { atk: 14 } },
      { count: 5, bonus: { def: 8, hp: 80 } },
    ],
  },
  desert_set: {
    id: "desert_set",
    name: "사막 세트",
    totalPieces: 5,
    tiers: [
      { count: 2, bonus: { agi: 8 } },
      { count: 3, bonus: { spd: 2 } },
      { count: 4, bonus: { atk: 22 } },
      { count: 5, bonus: { agi: 10 } },
    ],
  },
  snow_set: {
    id: "snow_set",
    name: "설원 세트",
    totalPieces: 5,
    tiers: [
      { count: 2, bonus: { hp: 100 } },
      { count: 3, bonus: { def: 18 } },
      { count: 4, bonus: { atk: 28, mdef: 10 } },
      { count: 5, bonus: { hp: 130, def: 10 } },
    ],
  },
  pirate_set: {
    id: "pirate_set",
    name: "해적 세트",
    totalPieces: 2,
    tiers: [{ count: 2, bonus: { agi: 10 } }],
  },
  ghost_set: {
    id: "ghost_set",
    name: "유령선 세트",
    totalPieces: 5,
    tiers: [
      { count: 2, bonus: { mdef: 10 } },
      { count: 3, bonus: { hp: 130 } },
      { count: 4, bonus: { atk: 42 } },
      { count: 5, bonus: { mdef: 10, agi: 8 } },
    ],
  },
  griffon_set: {
    id: "griffon_set",
    name: "그리폰 세트",
    totalPieces: 5,
    tiers: [
      { count: 2, bonus: { agi: 17 } },
      { count: 3, bonus: { spd: 2 } },
      { count: 4, bonus: { atk: 42 } },
      { count: 5, bonus: { agi: 22, atk: 35 } },
    ],
  },
};

export const EQUIPMENT_SLOT_LABELS: Record<import("../types").EquipmentSlot, string> = {
  head: "머리",
  body: "갑옷",
  gloves: "장갑",
  boots: "신발",
  weapon: "무기",
  ring: "반지",
};

// 장비 제작 골드/철 비용 — 세트 등급별 기준 (slot 배율 적용)
export const EQUIPMENT_SET_BASE_COST: Record<SetId, { gold: number; iron: number }> = {
  plains_set: { gold: 50, iron: 10 },
  forest_set: { gold: 200, iron: 50 },
  cave_set: { gold: 800, iron: 200 },
  ruins_set: { gold: 2500, iron: 700 },
  desert_set: { gold: 8000, iron: 2500 },
  snow_set: { gold: 25000, iron: 8000 },
  pirate_set: { gold: 80000, iron: 25000 },
  ghost_set: { gold: 200000, iron: 60000 },
  griffon_set: { gold: 250000, iron: 75000 },
};

const EQUIPMENT_SLOT_COST_MULT: Record<import("../types").EquipmentSlot, number> = {
  head: 1,
  body: 1.5,
  gloves: 1,
  boots: 1,
  weapon: 2,
  ring: 0.8,
};

export const getEquipmentResourceCost = (def: EquipmentDef): { gold: number; iron: number } => {
  if (!def.setId) return { gold: 0, iron: 0 };
  const base = EQUIPMENT_SET_BASE_COST[def.setId];
  const mult = EQUIPMENT_SLOT_COST_MULT[def.slot];
  return { gold: Math.floor(base.gold * mult), iron: Math.floor(base.iron * mult) };
};
