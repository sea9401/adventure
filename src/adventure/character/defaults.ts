import { ITEMS, type EquipItem } from "@/adventure/data/items";
import type { StatKey } from "@/adventure/data/stats";
import type { Skill } from "./types";

export const baseCharacter = {
  className: "무직",
  level: 1,
  hp: 50,
  maxHp: 50,
  mp: 30,
  maxMp: 30,
  exp: 0,
  maxExp: 100,
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
