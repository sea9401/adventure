import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import type { Skill } from "./types";

// 캐릭터가 동시에 활성화할 수 있는 스킬 수.
export const SKILL_SLOT_COUNT = 3;

// 스킬 이름 상수 — UI/엔진에서 모두 같은 키 사용.
export const SKILL_NAMES = {
  POWER_ATTACK: "강공격",
  EVADE: "회피 강화",
  DOUBLE_STRIKE: "연타",
  CRIT: "크리티컬",
  GUARD: "가드",
} as const;

// 강공격 — 힘 10 도달 시 획득.
// 효과: 3턴마다 자동 발동, 그 턴의 첫 공격이 ATK +2 데미지로 나감.
export const POWER_ATTACK_STR_THRESHOLD = 10;
export const POWER_ATTACK_BONUS = 2;
export const POWER_ATTACK_TURN_INTERVAL = 3;

// 회피 강화 — 민첩 10 도달 시 획득.
// 전투 시작 시 "보장 회피" 1회 적립 + 그 전투 동안 회피 확률 +EVADE_BONUS_PCT%.
export const EVADE_DEX_THRESHOLD = 10;
export const EVADE_GUARANTEED = 1;
export const EVADE_BONUS_PCT = 5;

// 연타 — 속도 15 도달 시 획득.
// 5턴마다 그 턴의 마지막 공격 후 추가 1회 공격.
export const DOUBLE_STRIKE_SPD_THRESHOLD = 15;
export const DOUBLE_STRIKE_INTERVAL = 5;

// 크리티컬 — 행운 10 도달 시 획득.
// 스킬 효과: 크리티컬 확률 +CRIT_CHANCE_PCT% 추가 (luk 1pt 당 +0.5% 기본과 누적).
// 발동 시 데미지 ×CRIT_MULT (강공격 보너스 후에 곱해짐).
export const CRIT_LUK_THRESHOLD = 10;
export const CRIT_CHANCE_PCT = 5;
export const CRIT_MULT = 2.5;
// luk 1pt 당 추가되는 기본 크리티컬 확률(%). 스킬 미장착 상태에서도 적용.
export const CRIT_CHANCE_PER_LUK = 0.5;

// 가드 — 활력 10 도달 시 획득.
// 전투 시작 후 첫 3턴 동안 받는 피해 -1 (최소 0).
export const GUARD_VIT_THRESHOLD = 10;
export const GUARD_TURNS = 3;
export const GUARD_REDUCTION = 1;

// 스탯 → 그 스탯이 주는 스킬 메타. 도감 노출 / 발동 판정 모두 이 매핑을 사용.
// activationThreshold 는 실제 효과가 발동되는 스탯값 — 도감 공개 임계
// (STAT_SKILL_INFO_THRESHOLD) 와 다를 수 있다 (예: 연타는 정보 공개 10, 발동 15).
export type StatSkillInfo = {
  name: string;
  description: string;
  activationThreshold: number;
};

export const STAT_SKILL: Record<StatKey, StatSkillInfo> = {
  str: {
    name: SKILL_NAMES.POWER_ATTACK,
    description: `${POWER_ATTACK_TURN_INTERVAL}턴마다 자동 발동 — ATK +${POWER_ATTACK_BONUS} 데미지로 공격`,
    activationThreshold: POWER_ATTACK_STR_THRESHOLD,
  },
  dex: {
    name: SKILL_NAMES.EVADE,
    description: `전투당 첫 ${EVADE_GUARANTEED}회 피격을 무조건 회피 + 회피 +${EVADE_BONUS_PCT}%`,
    activationThreshold: EVADE_DEX_THRESHOLD,
  },
  vit: {
    name: SKILL_NAMES.GUARD,
    description: `전투 시작 후 첫 ${GUARD_TURNS}턴 동안 받는 피해 -${GUARD_REDUCTION}`,
    activationThreshold: GUARD_VIT_THRESHOLD,
  },
  spd: {
    name: SKILL_NAMES.DOUBLE_STRIKE,
    description: `${DOUBLE_STRIKE_INTERVAL}턴마다 자동 발동 — 그 턴 마지막 공격 후 추가 1회 공격`,
    activationThreshold: DOUBLE_STRIKE_SPD_THRESHOLD,
  },
  luk: {
    name: SKILL_NAMES.CRIT,
    description: `크리티컬 확률 +${CRIT_CHANCE_PCT}% 추가, 발동 시 데미지 ×${CRIT_MULT}`,
    activationThreshold: CRIT_LUK_THRESHOLD,
  },
};

// 현재 스탯에서 보유(획득) 스킬 목록 도출. 스킬은 별도 저장 없이 스탯에서 파생.
// "보유" ≠ "장착" — 보유한 스킬 중 SKILL_SLOT_COUNT 개만 effective.
export function deriveSkills(stats: Record<StatKey, number>): Skill[] {
  return STAT_KEYS.filter(
    (k) => stats[k] >= STAT_SKILL[k].activationThreshold,
  ).map((k) => ({
    name: STAT_SKILL[k].name,
    description: STAT_SKILL[k].description,
  }));
}

// 보유 스킬 + 사용자 명시 선택 → 실제 발동될 스킬 이름 set.
// stored 가 undefined 면 첫 SKILL_SLOT_COUNT 개 자동 장착 (신규/마이그레이션).
// stored 가 설정돼 있으면 그 값 그대로 (보유 안 한 스킬은 필터). 빈 슬롯은 빈 채로.
export function effectiveSkillNames(
  available: Skill[],
  stored: string[] | undefined,
): string[] {
  const availableNames = available.map((s) => s.name);
  if (stored === undefined) {
    return availableNames.slice(0, SKILL_SLOT_COUNT);
  }
  const availableSet = new Set(availableNames);
  return stored.filter((n) => availableSet.has(n)).slice(0, SKILL_SLOT_COUNT);
}

// 전투 엔진이 사용할 보너스/효과 헬퍼 — 보유 + 장착 둘 다 만족해야 발동.
export function powerAttackBonusFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.str >= POWER_ATTACK_STR_THRESHOLD &&
    equipped.has(SKILL_NAMES.POWER_ATTACK)
    ? POWER_ATTACK_BONUS
    : 0;
}

export function evadeGuaranteedFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.dex >= EVADE_DEX_THRESHOLD && equipped.has(SKILL_NAMES.EVADE)
    ? EVADE_GUARANTEED
    : 0;
}

export function evadeBonusPctFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.dex >= EVADE_DEX_THRESHOLD && equipped.has(SKILL_NAMES.EVADE)
    ? EVADE_BONUS_PCT
    : 0;
}

export function doubleStrikeIntervalFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number | undefined {
  return stats.spd >= DOUBLE_STRIKE_SPD_THRESHOLD &&
    equipped.has(SKILL_NAMES.DOUBLE_STRIKE)
    ? DOUBLE_STRIKE_INTERVAL
    : undefined;
}

export function critChancePctFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  // 기본 — luk 1pt 당 +CRIT_CHANCE_PER_LUK% (스킬 미장착에도 적용).
  const base = stats.luk * CRIT_CHANCE_PER_LUK;
  // 스킬 장착 시 +CRIT_CHANCE_PCT% 추가.
  const skillBonus =
    stats.luk >= CRIT_LUK_THRESHOLD && equipped.has(SKILL_NAMES.CRIT)
      ? CRIT_CHANCE_PCT
      : 0;
  return base + skillBonus;
}

export function guardFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): { turns: number; reduction: number } {
  return stats.vit >= GUARD_VIT_THRESHOLD && equipped.has(SKILL_NAMES.GUARD)
    ? { turns: GUARD_TURNS, reduction: GUARD_REDUCTION }
    : { turns: 0, reduction: 0 };
}
