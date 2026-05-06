import type { CharacterClass, AdvancedClassId } from "./classes";
import type { SkillId } from "./skills";
import type { EquippedItems } from "./equipment";
import type { CodexState } from "./codex";

export type AllocatedStats = {
  str: number;
  vit: number;
  agi: number;
  int: number;
};

export type Character = {
  name: string;
  level: number;
  exp: number;
  skillExp: number;
  currentClass: CharacterClass;
  advancedClass?: AdvancedClassId;
  learnedAdvancedSkills?: SkillId[];
  currentHp: number;
  equippedSkills?: SkillId[];
  equipped?: EquippedItems;
  codex?: CodexState;
  // 레벨업 자유 분배 — 레벨당 +1 statPoints, 4개 스탯에 분배
  statPoints?: number;
  allocatedStats?: AllocatedStats;
};
