import type {
  AdvancedClassId,
  Character,
  CharacterClass,
  ClassPassive,
  SkillDef,
  SkillId,
} from "./types";
import { ADVANCED_BONUS_SKILL_SLOTS, BASE_MAX_EQUIPPED_SKILLS, MAX_EQUIPPED_SKILLS } from "./types";
import { ADVANCED_CLASSES, CLASSES, SKILLS } from "./data";

export const getMaxEquippedSkills = (c: Character): number =>
  BASE_MAX_EQUIPPED_SKILLS + (c.advancedClass ? ADVANCED_BONUS_SKILL_SLOTS : 0);

// 캐릭터의 활성 패시브: 2차 직업 있으면 그 패시브, 없으면 1차
export const getActivePassive = (c: Character): ClassPassive => {
  if (c.advancedClass) return ADVANCED_CLASSES[c.advancedClass].passive;
  return CLASSES[c.currentClass].passive;
};

// 캐릭터의 표시 클래스 이름
export const getActiveClassName = (c: Character): string => {
  if (c.advancedClass) return ADVANCED_CLASSES[c.advancedClass].name;
  return CLASSES[c.currentClass].name;
};

// dodgeChance / agiCritChance / playerDodgeChance / playerAgiCritChance — combat/damage.ts 로 이동.

export const getClassSkills = (cls: CharacterClass | AdvancedClassId): SkillDef[] =>
  Object.values(SKILLS).filter((s) => s.classId === cls);

// 캐릭터가 사용 가능한 모든 스킬 (1차 자동 + 2차 학습 완료분)
export const getAvailableSkills = (c: Character): SkillDef[] => {
  const base = getClassSkills(c.currentClass).filter((s) => c.level >= s.unlockLevel);
  if (!c.advancedClass) return base;
  const learnedSet = new Set(c.learnedAdvancedSkills ?? []);
  const adv = getClassSkills(c.advancedClass).filter(
    (s) => c.level >= s.unlockLevel && learnedSet.has(s.id),
  );
  return [...base, ...adv];
};

export const getEquippedSkills = (
  characterOrCls: Character | CharacterClass,
  level?: number,
  equippedSkills?: SkillId[],
): SkillDef[] => {
  // Character 객체 받은 경우 (신규 호출 패턴)
  if (typeof characterOrCls !== "string") {
    const c = characterOrCls;
    const max = getMaxEquippedSkills(c);
    const available = getAvailableSkills(c);
    const eq = c.equippedSkills;
    // undefined(미지정) → 자동 장착, [] 또는 부분 배열 → 사용자 선택 그대로 존중 (0개 가능)
    if (eq !== undefined) {
      const valid: SkillDef[] = [];
      for (const id of eq) {
        const s = available.find((sk) => sk.id === id);
        if (s) valid.push(s);
        if (valid.length >= max) break;
      }
      return valid;
    }
    return available.slice(0, max);
  }
  // 기존 (cls, level, equippedSkills) 호출 패턴 호환
  const cls = characterOrCls;
  const learned = getClassSkills(cls).filter((s) => (level ?? 0) >= s.unlockLevel);
  if (equippedSkills !== undefined) {
    const valid: SkillDef[] = [];
    for (const id of equippedSkills) {
      const s = learned.find((sk) => sk.id === id);
      if (s) valid.push(s);
      if (valid.length >= MAX_EQUIPPED_SKILLS) break;
    }
    return valid;
  }
  return learned.slice(0, MAX_EQUIPPED_SKILLS);
};
