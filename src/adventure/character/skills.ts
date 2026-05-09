import type { StatKey } from "@/adventure/data/stats";
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
// 전투 시작 시 "보장 회피" 1회 적립. 첫 적 공격을 % 회피 판정 전에 무조건 흡수.
export const EVADE_DEX_THRESHOLD = 10;
export const EVADE_GUARANTEED = 1;

// 연타 — 속도 15 도달 시 획득.
// 5턴마다 그 턴의 마지막 공격 후 추가 1회 공격.
export const DOUBLE_STRIKE_SPD_THRESHOLD = 15;
export const DOUBLE_STRIKE_INTERVAL = 5;

// 크리티컬 — 행운 10 도달 시 획득.
// 매 공격 5% 확률로 데미지 ×2 (강공격 보너스와 누적).
export const CRIT_LUK_THRESHOLD = 10;
export const CRIT_CHANCE_PCT = 5;
export const CRIT_MULT = 2;

// 가드 — 활력 10 도달 시 획득.
// 전투 시작 후 첫 3턴 동안 받는 피해 -1 (최소 0).
export const GUARD_VIT_THRESHOLD = 10;
export const GUARD_TURNS = 3;
export const GUARD_REDUCTION = 1;

// 현재 스탯에서 보유(획득) 스킬 목록 도출. 스킬은 별도 저장 없이 스탯에서 파생.
// "보유" ≠ "장착" — 보유한 스킬 중 SKILL_SLOT_COUNT 개만 effective.
export function deriveSkills(stats: Record<StatKey, number>): Skill[] {
  const out: Skill[] = [];
  if (stats.str >= POWER_ATTACK_STR_THRESHOLD) {
    out.push({
      name: SKILL_NAMES.POWER_ATTACK,
      description: `${POWER_ATTACK_TURN_INTERVAL}턴마다 자동 발동 — ATK +${POWER_ATTACK_BONUS} 데미지로 공격`,
    });
  }
  if (stats.dex >= EVADE_DEX_THRESHOLD) {
    out.push({
      name: SKILL_NAMES.EVADE,
      description: `전투당 첫 ${EVADE_GUARANTEED}회 피격을 무조건 회피`,
    });
  }
  if (stats.spd >= DOUBLE_STRIKE_SPD_THRESHOLD) {
    out.push({
      name: SKILL_NAMES.DOUBLE_STRIKE,
      description: `${DOUBLE_STRIKE_INTERVAL}턴마다 자동 발동 — 그 턴 마지막 공격 후 추가 1회 공격`,
    });
  }
  if (stats.luk >= CRIT_LUK_THRESHOLD) {
    out.push({
      name: SKILL_NAMES.CRIT,
      description: `매 공격 ${CRIT_CHANCE_PCT}% 확률로 데미지 ×${CRIT_MULT}`,
    });
  }
  if (stats.vit >= GUARD_VIT_THRESHOLD) {
    out.push({
      name: SKILL_NAMES.GUARD,
      description: `전투 시작 후 첫 ${GUARD_TURNS}턴 동안 받는 피해 -${GUARD_REDUCTION}`,
    });
  }
  return out;
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
  return stats.luk >= CRIT_LUK_THRESHOLD && equipped.has(SKILL_NAMES.CRIT)
    ? CRIT_CHANCE_PCT
    : 0;
}

export function guardFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): { turns: number; reduction: number } {
  return stats.vit >= GUARD_VIT_THRESHOLD && equipped.has(SKILL_NAMES.GUARD)
    ? { turns: GUARD_TURNS, reduction: GUARD_REDUCTION }
    : { turns: 0, reduction: 0 };
}
