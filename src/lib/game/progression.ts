import type { AdvancedClassId, Character, CharacterClass, SkillId } from "./types";
import { ADVANCED_CLASSES, ADVANCED_LEVEL_CAP, LEVEL_CAP, SKILLS, expForLevel } from "./data";
import { computeStats } from "./stats";

export const getLevelCap = (character: Character): number =>
  character.advancedClass ? ADVANCED_LEVEL_CAP : LEVEL_CAP;

// 레벨 마일스톤 — 도달 시 축하 모달 표시
export const LEVEL_MILESTONES = [50, 100, 125, 150] as const;
export const getCrossedMilestones = (oldLevel: number, newLevel: number): number[] =>
  LEVEL_MILESTONES.filter((m) => oldLevel < m && m <= newLevel);

export const applyExp = (character: Character, gainedExp: number): Character => {
  let { level, exp } = character;
  let skillExp = character.skillExp ?? 0;
  const cap = getLevelCap(character);
  exp += gainedExp;
  const oldLevel = level;
  while (level < cap && exp >= expForLevel(level)) {
    exp -= expForLevel(level);
    level += 1;
  }
  // 캡 도달 후 잉여 EXP는 skillExp로 누적 (2차 전직 스킬 학습에 사용)
  if (level >= cap && exp > 0) {
    skillExp += exp;
    exp = 0;
  }
  // 레벨업 자유 분배 — 오른 만큼 statPoints 누적
  const gainedLevels = level - oldLevel;
  const statPoints = (character.statPoints ?? 0) + gainedLevels;
  return { ...character, level, exp, skillExp, statPoints };
};

export const changeCharacterClass = (character: Character, newClass: CharacterClass): Character => {
  if (character.currentClass === newClass) return character;
  const oldStats = computeStats(character);
  const pct = oldStats.maxHp > 0 ? character.currentHp / oldStats.maxHp : 1;
  const updated = { ...character, currentClass: newClass, equippedSkills: undefined };
  const newStats = computeStats(updated);
  return { ...updated, currentHp: Math.floor(newStats.maxHp * pct) };
};

// 2차 전직 — Lv 100 + 1차 직군 일치 필요
export const advanceCharacterClass = (
  character: Character,
  advancedId: AdvancedClassId,
): Character | null => {
  if (character.level < LEVEL_CAP) return null;
  const def = ADVANCED_CLASSES[advancedId];
  if (!def) return null;
  if (def.parent !== character.currentClass) return null;
  if (character.advancedClass === advancedId) return character;

  const oldStats = computeStats(character);
  const pct = oldStats.maxHp > 0 ? character.currentHp / oldStats.maxHp : 1;

  // 같은 직군 내 다른 분기 변경: 학습한 advanced 스킬 환불 없음 (재학습 필요)
  // 다른 직군이면 그냥 advancedClass 교체 (1차 클래스가 다르므로 이 분기는 사실상 일어날 수 없음)
  const updated: Character = {
    ...character,
    advancedClass: advancedId,
    learnedAdvancedSkills: [],
    equippedSkills: undefined,
  };
  const newStats = computeStats(updated);
  return { ...updated, currentHp: Math.floor(newStats.maxHp * pct) };
};

// 2차 전직 해제 — 학습 차감분 100% skillExp 환불
export const removeAdvancedClass = (character: Character): Character => {
  if (!character.advancedClass) return character;
  const refund = (character.learnedAdvancedSkills ?? []).reduce((sum, sid) => {
    const s = SKILLS[sid];
    return sum + (s?.learnCost ?? 0);
  }, 0);
  const oldStats = computeStats(character);
  const pct = oldStats.maxHp > 0 ? character.currentHp / oldStats.maxHp : 1;
  // 2차 해제 시 1차 캡(100)으로 클램프 — 잉여 레벨만큼의 EXP는 skillExp로 환원
  const clampedLevel = Math.min(character.level, LEVEL_CAP);
  const updated: Character = {
    ...character,
    level: clampedLevel,
    exp: clampedLevel < character.level ? 0 : character.exp,
    advancedClass: undefined,
    learnedAdvancedSkills: [],
    equippedSkills: undefined,
    skillExp: character.skillExp + refund,
  };
  const newStats = computeStats(updated);
  return { ...updated, currentHp: Math.floor(newStats.maxHp * pct) };
};

// 2차 전직 스킬 학습 — skillExp에서 learnCost 차감
export const learnAdvancedSkill = (character: Character, skillId: SkillId): Character | null => {
  if (!character.advancedClass) return null;
  const def = SKILLS[skillId];
  if (!def || def.classId !== character.advancedClass) return null;
  if (def.learnCost === undefined) return null;
  if ((character.learnedAdvancedSkills ?? []).includes(skillId)) return null;
  if (character.skillExp < def.learnCost) return null;
  return {
    ...character,
    skillExp: character.skillExp - def.learnCost,
    learnedAdvancedSkills: [...(character.learnedAdvancedSkills ?? []), skillId],
  };
};
