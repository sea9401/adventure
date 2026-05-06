import type { Stats } from "./stats";

export type ArenaTier = "npc" | "random";

export type ArenaSnapshot = {
  nickname: string;
  level: number;
  className: string;
  stats: Stats;
  power: number;
  equippedSkillNames: string[];
  equippedItemNames: string[];
  registeredAt: number;
};
