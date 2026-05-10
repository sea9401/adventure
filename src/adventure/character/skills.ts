import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import type { Skill } from "./types";

// 캐릭터가 동시에 활성화할 수 있는 스킬 수.
export const SKILL_SLOT_COUNT = 3;

// 스킬 이름 상수 — UI/엔진에서 모두 같은 키 사용.
export const SKILL_NAMES = {
  POWER_ATTACK: "강공격",
  CRUSH: "분쇄",
  EVADE: "회피 강화",
  COUNTER: "반격",
  GUARD: "가드",
  REGEN: "재생",
  DOUBLE_STRIKE: "연타",
  VANGUARD: "기습",
  CRIT: "크리티컬",
  DOUBLE_LUCK: "이중 행운",
} as const;

// 강공격 — 힘 10 도달 시 획득.
// 효과: 3턴마다 자동 발동, 그 턴의 첫 공격이 ATK +2 데미지로 나감.
export const POWER_ATTACK_STR_THRESHOLD = 10;
export const POWER_ATTACK_BONUS = 2;
export const POWER_ATTACK_TURN_INTERVAL = 3;

// 분쇄 — 힘 20 도달 시 획득.
// 효과: 강공격 발동 턴, 그 공격이 적 방어력 -CRUSH_DEF_REDUCTION 으로 계산 (최소 0).
export const CRUSH_STR_THRESHOLD = 20;
export const CRUSH_DEF_REDUCTION = 3;

// 회피 강화 — 민첩 10 도달 시 획득.
// 전투 시작 시 "보장 회피" 1회 적립 + 그 전투 동안 회피 확률 +EVADE_BONUS_PCT%.
export const EVADE_DEX_THRESHOLD = 10;
export const EVADE_GUARANTEED = 1;
export const EVADE_BONUS_PCT = 5;

// 반격 — 민첩 20 도달 시 획득.
// 효과: 회피 성공 시 즉시 카운터 1회 (ATK +COUNTER_ATK_BONUS).
export const COUNTER_DEX_THRESHOLD = 20;
export const COUNTER_ATK_BONUS = 1;

// 가드 — 활력 10 도달 시 획득.
// 전투 시작 후 첫 3턴 동안 받는 피해 -1 (최소 0).
export const GUARD_VIT_THRESHOLD = 10;
export const GUARD_TURNS = 3;
export const GUARD_REDUCTION = 1;

// 재생 — 활력 20 도달 시 획득.
// 효과: 매 REGEN_INTERVAL 플레이어 턴 종료 시 HP +REGEN_AMOUNT.
export const REGEN_VIT_THRESHOLD = 20;
export const REGEN_INTERVAL = 5;
export const REGEN_AMOUNT = 5;

// 연타 — 속도 10 도달 시 획득.
// 5턴마다 그 턴의 마지막 공격 후 추가 1회 공격.
export const DOUBLE_STRIKE_SPD_THRESHOLD = 10;
export const DOUBLE_STRIKE_INTERVAL = 5;

// 기습 — 속도 20 도달 시 획득.
// 효과: 전투 첫 플레이어 턴, 추가 공격 1회.
export const VANGUARD_SPD_THRESHOLD = 20;
export const VANGUARD_FIRST_TURN_BONUS = 1;

// 크리티컬 — 행운 10 도달 시 획득.
// 스킬 효과: 크리티컬 확률 +CRIT_CHANCE_PCT% 추가 (luk 1pt 당 +0.5% 기본과 누적).
// 발동 시 데미지 ×CRIT_MULT (강공격 보너스 후에 곱해짐).
export const CRIT_LUK_THRESHOLD = 10;
export const CRIT_CHANCE_PCT = 5;
export const CRIT_MULT = 2.5;
// luk 1pt 당 추가되는 기본 크리티컬 확률(%). 스킬 미장착 상태에서도 적용.
export const CRIT_CHANCE_PER_LUK = 0.5;

// 이중 행운 — 행운 20 도달 시 획득.
// 효과: 크리티컬 발동 시 그 전투 동안 회피 +DOUBLE_LUCK_EVADE_BONUS%, 크리 +DOUBLE_LUCK_CRIT_BONUS% (누적 X).
export const DOUBLE_LUCK_LUK_THRESHOLD = 20;
export const DOUBLE_LUCK_EVADE_BONUS = 5;
export const DOUBLE_LUCK_CRIT_BONUS = 5;

// 스탯 → 그 스탯이 주는 스킬 티어들 (낮은 임계 → 높은 임계 순). 도감 노출 / 발동 판정 모두 이 매핑을 사용.
// 1차 티어는 STAT_SKILL_INFO_THRESHOLD(5) 도달 시 도감 공개,
// 2차 티어는 STAT_REVEAL_THRESHOLD(15) 도달 시 도감 공개. 발동 임계는 별도 (1차 10/15, 2차 20/30).
export type StatSkillInfo = {
  name: string;
  description: string;
  activationThreshold: number;
};

export const STAT_SKILL: Record<StatKey, StatSkillInfo[]> = {
  str: [
    {
      name: SKILL_NAMES.POWER_ATTACK,
      description: `${POWER_ATTACK_TURN_INTERVAL}턴마다 자동 발동 — ATK +${POWER_ATTACK_BONUS} 데미지로 공격`,
      activationThreshold: POWER_ATTACK_STR_THRESHOLD,
    },
    {
      name: SKILL_NAMES.CRUSH,
      description: `강공격 발동 턴, 그 공격이 적 방어력 -${CRUSH_DEF_REDUCTION} 으로 계산`,
      activationThreshold: CRUSH_STR_THRESHOLD,
    },
  ],
  dex: [
    {
      name: SKILL_NAMES.EVADE,
      description: `전투당 첫 ${EVADE_GUARANTEED}회 피격을 무조건 회피 + 회피 +${EVADE_BONUS_PCT}%`,
      activationThreshold: EVADE_DEX_THRESHOLD,
    },
    {
      name: SKILL_NAMES.COUNTER,
      description: `회피 성공 시 즉시 카운터 1회 (ATK +${COUNTER_ATK_BONUS})`,
      activationThreshold: COUNTER_DEX_THRESHOLD,
    },
  ],
  vit: [
    {
      name: SKILL_NAMES.GUARD,
      description: `전투 시작 후 첫 ${GUARD_TURNS}턴 동안 받는 피해 -${GUARD_REDUCTION}`,
      activationThreshold: GUARD_VIT_THRESHOLD,
    },
    {
      name: SKILL_NAMES.REGEN,
      description: `${REGEN_INTERVAL}턴마다 HP +${REGEN_AMOUNT} 회복`,
      activationThreshold: REGEN_VIT_THRESHOLD,
    },
  ],
  spd: [
    {
      name: SKILL_NAMES.DOUBLE_STRIKE,
      description: `${DOUBLE_STRIKE_INTERVAL}턴마다 자동 발동 — 그 턴 마지막 공격 후 추가 1회 공격`,
      activationThreshold: DOUBLE_STRIKE_SPD_THRESHOLD,
    },
    {
      name: SKILL_NAMES.VANGUARD,
      description: `전투 첫 턴 추가 공격 ${VANGUARD_FIRST_TURN_BONUS}회`,
      activationThreshold: VANGUARD_SPD_THRESHOLD,
    },
  ],
  luk: [
    {
      name: SKILL_NAMES.CRIT,
      description: `크리티컬 확률 +${CRIT_CHANCE_PCT}% 추가, 발동 시 데미지 ×${CRIT_MULT}`,
      activationThreshold: CRIT_LUK_THRESHOLD,
    },
    {
      name: SKILL_NAMES.DOUBLE_LUCK,
      description: `크리티컬 발동 시 그 전투 동안 회피 +${DOUBLE_LUCK_EVADE_BONUS}%, 크리 +${DOUBLE_LUCK_CRIT_BONUS}% (누적 X)`,
      activationThreshold: DOUBLE_LUCK_LUK_THRESHOLD,
    },
  ],
};

// 현재 스탯에서 보유(획득) 스킬 목록 도출. 스킬은 별도 저장 없이 스탯에서 파생.
// "보유" ≠ "장착" — 보유한 스킬 중 SKILL_SLOT_COUNT 개만 effective.
// 1차 티어 → 2차 티어 순으로 묶어 반환 — 자동 슬롯 채움 시 1차가 우선되도록.
export function deriveSkills(stats: Record<StatKey, number>): Skill[] {
  const tier1: Skill[] = [];
  const tier2: Skill[] = [];
  for (const k of STAT_KEYS) {
    const tiers = STAT_SKILL[k];
    if (tiers[0] && stats[k] >= tiers[0].activationThreshold) {
      tier1.push({
        name: tiers[0].name,
        description: tiers[0].description,
      });
    }
    if (tiers[1] && stats[k] >= tiers[1].activationThreshold) {
      tier2.push({
        name: tiers[1].name,
        description: tiers[1].description,
      });
    }
  }
  return [...tier1, ...tier2];
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

export function crushDefReductionFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.str >= CRUSH_STR_THRESHOLD && equipped.has(SKILL_NAMES.CRUSH)
    ? CRUSH_DEF_REDUCTION
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

export function counterAtkBonusFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.dex >= COUNTER_DEX_THRESHOLD && equipped.has(SKILL_NAMES.COUNTER)
    ? COUNTER_ATK_BONUS
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

export function vanguardFirstTurnBonusFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.spd >= VANGUARD_SPD_THRESHOLD &&
    equipped.has(SKILL_NAMES.VANGUARD)
    ? VANGUARD_FIRST_TURN_BONUS
    : 0;
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

export function doubleLuckBonusesFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): { evade: number; crit: number } {
  return stats.luk >= DOUBLE_LUCK_LUK_THRESHOLD &&
    equipped.has(SKILL_NAMES.DOUBLE_LUCK)
    ? { evade: DOUBLE_LUCK_EVADE_BONUS, crit: DOUBLE_LUCK_CRIT_BONUS }
    : { evade: 0, crit: 0 };
}

export function guardFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): { turns: number; reduction: number } {
  return stats.vit >= GUARD_VIT_THRESHOLD && equipped.has(SKILL_NAMES.GUARD)
    ? { turns: GUARD_TURNS, reduction: GUARD_REDUCTION }
    : { turns: 0, reduction: 0 };
}

export function regenFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): { interval: number; amount: number } {
  return stats.vit >= REGEN_VIT_THRESHOLD && equipped.has(SKILL_NAMES.REGEN)
    ? { interval: REGEN_INTERVAL, amount: REGEN_AMOUNT }
    : { interval: 0, amount: 0 };
}
