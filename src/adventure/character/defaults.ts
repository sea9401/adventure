import { ITEMS, type EquipItem } from "@/adventure/data/items";
import type { StatKey } from "@/adventure/data/stats";
import type { Skill } from "./types";

// 레벨 1 기준 베이스 — 레벨 N의 max는 baseCharacter.max{Hp,Mp} + (N-1) * {HP,MP}_PER_LEVEL.
export const HP_PER_LEVEL = 5;
export const MP_PER_LEVEL = 2;

export const baseCharacter = {
  className: "무직",
  level: 1,
  hp: 50,
  maxHp: 50,
  mp: 30,
  maxMp: 30,
  exp: 0,
  maxExp: 120,
  gold: 0,
  affiliation: "무소속",
  battleCount: 0,
  fame: 0,
  skills: [] as Skill[],
  stats: { str: 3, dex: 3, vit: 3, spd: 3, luk: 3 } as Record<StatKey, number>,
  equipped: {
    weapon: ITEMS.branch_stick as EquipItem | null,
    armor: ITEMS.cloth_clothes as EquipItem | null,
    accessory: ITEMS.mom_amulet as EquipItem | null,
  },
};

export function maxHpForLevel(level: number): number {
  return baseCharacter.maxHp + Math.max(0, level - 1) * HP_PER_LEVEL;
}

export function maxMpForLevel(level: number): number {
  return baseCharacter.maxMp + Math.max(0, level - 1) * MP_PER_LEVEL;
}
