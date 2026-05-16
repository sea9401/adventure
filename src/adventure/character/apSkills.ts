// AP 스킬 시스템 — 스킬북으로 학습해 슬롯 장착, 전투 중 AP 소비해 발동.
// 기존 스탯 임계 스킬(STAT_SKILL) 과 별개 카테고리. 같은 equippedSkills 슬롯 풀 공유.
// AP 회복: 매 플레이어 행동 +1. cap 도달 시 정지. 매 전투 시작 시 AP_BATTLE_START 로 리셋.
// AI 발동: 매 턴 슬롯 순서로 첫 발동 가능한 AP 스킬 1개 발동 (한 턴 최대 1개).

export const AP_CAP = 5;
export const AP_BATTLE_START = 2;

export type APSkillId = "shadow_cut";

export type APSkillEffect =
  // 본타 데미지를 ATK × atkMult 로 갱신. ignoresDef = true 면 적 DEF 무시.
  | { kind: "atk_multiplier"; atkMult: number; ignoresDef?: boolean };

export type APSkill = {
  /** 내부 id — 데이터 식별용. user-facing 은 name. */
  id: APSkillId;
  /** 표시 이름. equippedSkills 배열의 키. STAT_SKILL 의 이름과 충돌 X. */
  name: string;
  description: string;
  apCost: number;
  effect: APSkillEffect;
};

// PR-0 검증용 1개. PR-1 부터 나머지 19개 추가 예정 (mockup 락인된 리스트).
export const AP_SKILLS: APSkill[] = [
  {
    id: "shadow_cut",
    name: "그림자 베기",
    description: "ATK × 1.5 단발, 적 DEF 무시",
    apCost: 3,
    effect: { kind: "atk_multiplier", atkMult: 1.5, ignoresDef: true },
  },
];

export function getAPSkillByName(name: string): APSkill | undefined {
  return AP_SKILLS.find((s) => s.name === name);
}

export function getAPSkillById(id: APSkillId): APSkill | undefined {
  return AP_SKILLS.find((s) => s.id === id);
}

export function isAPSkillName(name: string): boolean {
  return AP_SKILLS.some((s) => s.name === name);
}

// SkillsView 등 UI 에 표시할 description — 코스트를 앞에 prefix 해 한눈에 들어오게.
// 데이터의 raw description 은 효과만 담고 표시 시 합성. apCost 변경 시 description 보정 불필요.
export function formatAPSkillDescription(skill: APSkill): string {
  return `AP ${skill.apCost} · ${skill.description}`;
}
