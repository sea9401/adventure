// AP 스킬 시스템 — 스킬북으로 학습해 슬롯 장착, 전투 중 AP 소비해 발동.
// 기존 스탯 임계 스킬(STAT_SKILL) 과 별개 카테고리. 같은 equippedSkills 슬롯 풀 공유.
// AP 회복: 매 플레이어 행동 +1. cap 도달 시 정지. 매 전투 시작 시 AP_BATTLE_START 로 리셋.
// AI 발동: 매 턴 슬롯 순서로 첫 발동 가능한 AP 스킬 1개 발동 (한 턴 최대 1개).

export const AP_CAP = 5;
export const AP_BATTLE_START = 2;

export type APSkillId =
  | "shadow_cut"
  | "extra_evade"
  | "mending"
  | "heaven_slay"
  | "deep_wound";

export type APSkillEffect =
  // 본타 데미지를 ATK × atkMult 로 갱신. ignoresDef = true 면 적 DEF 무시.
  // ignoresEvasion = true 면 적 회피 굴림 자체를 스킵 — 첫 공격은 100% 명중.
  | {
      kind: "atk_multiplier";
      atkMult: number;
      ignoresDef?: boolean;
      ignoresEvasion?: boolean;
    }
  // 발동 즉시 자가 회복 — maxHp × pct/100 만큼 (현재 HP 위에 누적, maxHp 클램프).
  | { kind: "heal_pct"; pct: number }
  // 발동 즉시 적에게 출혈 스택 N 부여 (기존 stacks 와 누적).
  | { kind: "apply_bleed"; stacks: number }
  // 발동 즉시 보장 회피 횟수 +N (회피 강화 패시브와 누적).
  | { kind: "add_guaranteed_evades"; count: number };

export type APSkill = {
  /** 내부 id — 데이터 식별용. user-facing 은 name. */
  id: APSkillId;
  /** 표시 이름. equippedSkills 배열의 키. STAT_SKILL 의 이름과 충돌 X. */
  name: string;
  description: string;
  apCost: number;
  effect: APSkillEffect;
};

export const AP_SKILLS: APSkill[] = [
  {
    id: "shadow_cut",
    name: "그림자 베기",
    description: "ATK × 1.5 단발, 적 DEF 무시",
    apCost: 3,
    effect: { kind: "atk_multiplier", atkMult: 1.5, ignoresDef: true },
  },
  {
    id: "extra_evade",
    name: "추가 회피",
    description: "보장 회피 횟수 +1 (회피 강화 패시브와 누적)",
    apCost: 1,
    effect: { kind: "add_guaranteed_evades", count: 1 },
  },
  {
    id: "mending",
    name: "회복술",
    description: "즉시 maxHP × 25% 회복",
    apCost: 3,
    effect: { kind: "heal_pct", pct: 25 },
  },
  {
    id: "heaven_slay",
    name: "천살",
    description: "ATK × 3.0 단발, 회피·DEF 모두 무시",
    apCost: 5,
    effect: {
      kind: "atk_multiplier",
      atkMult: 3.0,
      ignoresDef: true,
      ignoresEvasion: true,
    },
  },
  {
    id: "deep_wound",
    name: "깊은 상처",
    description: "적에게 출혈 5스택 즉시 부여 (출혈 패시브와 시너지)",
    apCost: 3,
    effect: { kind: "apply_bleed", stacks: 5 },
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
