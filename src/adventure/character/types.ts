import type { EquipItem } from "@/adventure/data/items";
import type { CraftTier } from "@/adventure/data/craftQuality";
import type { StatKey } from "@/adventure/data/stats";
import type { Gender } from "@/adventure/profile/avatars";

export type Skill = {
  name: string;
  description?: string;
};

// 슬롯에 들어가는 장비 — 제작산이면 등급(craftTier)이 박혀 있고 bonus·stats 는 그 등급 반영본.
// craftTier 미지정/0 = 평범한 장비(드랍/상점/퀘스트/시작 장비, 또는 일반 등급 제작산).
export type EquippedItem = EquipItem & { craftTier?: CraftTier };

export type EquippedSlots = {
  weapon: EquippedItem | null;
  armor: EquippedItem | null;
  accessory: EquippedItem | null;
};

export type Character = {
  name: string;
  className: string;
  /** 장착 중인 칭호 이름 (TITLES[id].name). 미장착이면 undefined. */
  titleName?: string;
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
