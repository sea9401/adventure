import type { EquipItem } from "@/adventure/data/items";
import type { StatKey } from "@/adventure/data/stats";
import type { Gender } from "@/components/NameSetupModal";

export type Skill = {
  name: string;
  description?: string;
};

export type EquippedSlots = {
  weapon: EquipItem | null;
  armor: EquipItem | null;
  accessory: EquipItem | null;
};

export type Character = {
  name: string;
  className: string;
  gender: Gender;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  maxExp: number;
  gold: number;
  affiliation: string;
  battleCount: number;
  fame: number;
  skills: Skill[];
  stats: Record<StatKey, number>;
  equipped: EquippedSlots;
};
