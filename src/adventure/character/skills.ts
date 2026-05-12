import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import type { Skill } from "./types";

// 기본 일반 스킬 슬롯 수 (해금 전). 동적 슬롯 수는 skillLayout() 참조.
export const SKILL_SLOT_COUNT = 3;
export const BASE_NORMAL_SLOTS = SKILL_SLOT_COUNT;

// ── 스킬 슬롯 해금 ───────────────────────────────────────────────────────
// 4번째 = 특기 전용 슬롯 (Lv40 또는 운봉의 거인 처치 — 먼저 만족 시).
// 5번째 = 일반 슬롯 (Lv65 그리고 화산의 심장 처치 — 둘 다).
export const SKILL_SLOT_UNLOCK = {
  FEAT_SLOT_LEVEL: 40,
  FEAT_SLOT_FLAG: "peak_giant_defeated",
  FIFTH_NORMAL_LEVEL: 65,
  FIFTH_NORMAL_FLAG: "volcano_heart_defeated",
} as const;

export type SkillSlotContext = {
  level: number;
  hasFlag: (id: string) => boolean;
};
export type SkillLayout = {
  /** 일반 스킬 슬롯 수 (3 또는 4). */
  normalSlots: number;
  /** 특기 전용 슬롯이 열렸는지 (true 면 특기 1개 장착 가능). */
  hasFeatSlot: boolean;
};

export function skillLayout(ctx: SkillSlotContext): SkillLayout {
  const fifthNormal =
    ctx.level >= SKILL_SLOT_UNLOCK.FIFTH_NORMAL_LEVEL &&
    ctx.hasFlag(SKILL_SLOT_UNLOCK.FIFTH_NORMAL_FLAG);
  return {
    normalSlots: BASE_NORMAL_SLOTS + (fifthNormal ? 1 : 0),
    hasFeatSlot:
      ctx.level >= SKILL_SLOT_UNLOCK.FEAT_SLOT_LEVEL ||
      ctx.hasFlag(SKILL_SLOT_UNLOCK.FEAT_SLOT_FLAG),
  };
}

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
  EXECUTION: "처형",
  PRECISION: "정확",
  ENDURANCE: "불굴",
  LIGHTSPEED: "광속",
  BLOOM: "만개",
  // 4티어 (각 스탯 50 도달).
  BLOODLET: "출혈",
  SHADOW_CLONE: "그림자 분신",
  BULWARK: "철벽",
  FLURRY: "무피해 난무",
  HEAVEN_DECREE: "천명",
} as const;

// 강공격 — 힘 10 도달 시 획득.
// 효과: 3턴마다 자동 발동, 그 턴의 첫 공격이 ATK +2 데미지로 나감.
export const POWER_ATTACK_STR_THRESHOLD = 10;
export const POWER_ATTACK_BONUS = 2;
export const POWER_ATTACK_TURN_INTERVAL = 3;

// 분쇄 — 힘 20 도달 시 획득.
// 효과: 강공격 발동 턴, 그 공격이 적 방어력 -floor(STR × CRUSH_DEF_PER_STR) 으로 계산 (최소 0).
// STR 비례라 후반에도 유효 — STR 20=-10 / 40=-20 / 70=-35.
export const CRUSH_STR_THRESHOLD = 20;
export const CRUSH_DEF_PER_STR = 0.5;

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
// 효과: 매 REGEN_INTERVAL 플레이어 턴 종료 시 HP +floor(VIT × REGEN_HP_PER_VIT).
// VIT 비례라 후반에도 유효 — VIT 20=+10 / 40=+20 / 70=+35.
export const REGEN_VIT_THRESHOLD = 20;
export const REGEN_INTERVAL = 5;
export const REGEN_HP_PER_VIT = 0.5;

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
// 발동 시 데미지 ×critMult (강공격 보너스 후에 곱해짐). critMult 는 luk 비례 — 아래 critMultFor.
export const CRIT_LUK_THRESHOLD = 10;
export const CRIT_CHANCE_PCT = 5;
// 크리티컬 데미지 배수 — luk 0 일 때의 기본 + luk 1pt 당 추가.
// luk 20 = 2.5 (이전 고정값과 동일), luk 50 = 3.25. 스킬 미장착에도 적용 (크리티컬 자체가 luk 1pt 당 +0.5% 라 어차피 luk 빌드용).
export const CRIT_MULT_BASE = 2.0;
export const CRIT_MULT_PER_LUK = 0.025;
// luk 1pt 당 추가되는 기본 크리티컬 확률(%). 스킬 미장착 상태에서도 적용.
export const CRIT_CHANCE_PER_LUK = 0.5;

// 이중 행운 — 행운 20 도달 시 획득.
// 효과: 크리티컬 발동 시 그 전투 동안 회피 +DOUBLE_LUCK_EVADE_BONUS%, 크리티컬 +DOUBLE_LUCK_CRIT_BONUS% (누적 X).
export const DOUBLE_LUCK_LUK_THRESHOLD = 20;
export const DOUBLE_LUCK_EVADE_BONUS = 5;
export const DOUBLE_LUCK_CRIT_BONUS = 5;

// 처형 — 힘 35 도달 시 획득.
// 효과: 적 HP 가 EXECUTION_HP_FRACTION 미만일 때 모든 공격 데미지 ×EXECUTION_DAMAGE_MULT.
// 강공격/분쇄와 누적되며, 크리티컬은 처형 후 데미지에 곱해진다.
export const EXECUTION_STR_THRESHOLD = 35;
export const EXECUTION_HP_FRACTION = 0.3;
export const EXECUTION_DAMAGE_MULT = 1.5;

// 정확 — 민첩 35 도달 시 획득.
// 효과 1) 모든 공격에 대해 적 evasion ×PRECISION_EVASION_MULT (절반). 회피 무력화가 아닌 비례 감소.
// 효과 2) 플레이어 공격의 최소 데미지를 1 → 1 + floor(DEX / PRECISION_MIN_DAMAGE_STEP) 로 올린다.
//   장비/레벨이 한참 모자라 ATK-DEF 가 1 이하일 때만 체감되는 안전망 — DEF 무시 백도어가 아니라
//   "약점을 노린다" 의 보조 효과. DEX 35=최소2 / 60=최소3 / 90=최소4.
export const PRECISION_DEX_THRESHOLD = 35;
export const PRECISION_EVASION_MULT = 0.5;
export const PRECISION_MIN_DAMAGE_STEP = 30;

// 불굴 — 활력 35 도달 시 획득.
// 효과 1) 전투당 1회, HP 가 0 이 되는 데미지 받으면 HP 1 로 버틴다.
// 효과 2) max HP +ENDURANCE_MAX_HP_BONUS_PCT% (계산은 호출 측에서 vit 보너스 위에 곱).
export const ENDURANCE_VIT_THRESHOLD = 35;
export const ENDURANCE_MAX_HP_BONUS_PCT = 10;

// 광속 — 속도 35 도달 시 획득.
// 효과: 매 턴 마지막 공격 후 LIGHTSPEED_EXTRA_ATTACK_CHANCE_PCT% 확률로 추가 1회 공격.
// 연타와 별개 발동 — 연타 슬롯이 없어도 단독으로 작동, 둘 다 슬롯 시 한 턴에 +2 공격까지 가능.
export const LIGHTSPEED_SPD_THRESHOLD = 35;
export const LIGHTSPEED_EXTRA_ATTACK_CHANCE_PCT = 5;

// 만개 — 행운 35 도달 시 획득.
// 효과 1) 크리티컬 데미지 배수 +BLOOM_CRIT_MULT_BONUS (현재 luk 비례 위에 누적).
// 효과 2) 크리티컬 확률 +BLOOM_CRIT_CHANCE_BONUS_PCT% (luk×0.5 + 크리티컬 슬롯 5% 위에 누적).
export const BLOOM_LUK_THRESHOLD = 35;
export const BLOOM_CRIT_MULT_BONUS = 0.5;
export const BLOOM_CRIT_CHANCE_BONUS_PCT = 3;

// ── 4티어 (각 스탯 50 도달) — 전부 자체 완결, 새 메커니즘 ─────────────────
// 출혈 — 적중 시 출혈 1스택(중첩). 매 적 턴마다 스택당 floor(STR × BLOODLET_DMG_PER_STR) 고정 피해(DEF 무시).
export const BLOODLET_STR_THRESHOLD = 50;
export const BLOODLET_DMG_PER_STR = 0.1;
// 그림자 분신 — 매 플레이어 턴 종료 시 분신이 추가 공격 1회 (ATK의 SHADOW_CLONE_ATK_PCT%).
export const SHADOW_CLONE_DEX_THRESHOLD = 50;
export const SHADOW_CLONE_ATK_PCT = 50;
// 철벽 — 전투 시작 시 floor(VIT × BULWARK_SHIELD_PER_VIT) 보호막. 데미지 우선 흡수, 회복 안 됨.
export const BULWARK_VIT_THRESHOLD = 50;
export const BULWARK_SHIELD_PER_VIT = 0.6;
// 무피해 난무 — 매 플레이어 턴 종료 시, 그 전투에서 받은 누적 피해가 0이면 추가 공격 floor(SPD / FLURRY_SPD_DIVISOR)회.
export const FLURRY_SPD_THRESHOLD = 50;
export const FLURRY_SPD_DIVISOR = 25;
// 천명 — 모든 공격에 (LUK × HEAVEN_DECREE_CHANCE_PER_LUK)% 확률로 적 현재 HP의 HEAVEN_DECREE_HP_PCT% 추가 고정 피해.
export const HEAVEN_DECREE_LUK_THRESHOLD = 50;
export const HEAVEN_DECREE_CHANCE_PER_LUK = 0.3;
export const HEAVEN_DECREE_HP_PCT = 5;

// 스탯 → 그 스탯이 주는 스킬 티어들 (낮은 임계 → 높은 임계 순). 도감 노출 / 발동 판정 모두 이 매핑을 사용.
// 1차 티어는 STAT_SKILL_INFO_THRESHOLD(5) 도달 시 도감 공개,
// 2차 티어는 STAT_REVEAL_THRESHOLD(15) 도달 시 도감 공개,
// 3차 티어는 STAT_TIER3_REVEAL_THRESHOLD(30) 도달 시 도감 공개. 발동 임계는 1차 10, 2차 20, 3차 35.
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
      description: `강공격 발동 턴, 그 공격이 적 방어력 -(STR × ${CRUSH_DEF_PER_STR}) 으로 계산 — STR 20=-10`,
      activationThreshold: CRUSH_STR_THRESHOLD,
    },
    {
      name: SKILL_NAMES.EXECUTION,
      description: `적 HP ${Math.round(EXECUTION_HP_FRACTION * 100)}% 미만일 때 모든 공격 데미지 ×${EXECUTION_DAMAGE_MULT}`,
      activationThreshold: EXECUTION_STR_THRESHOLD,
    },
    {
      name: SKILL_NAMES.BLOODLET,
      description: `적중 시 출혈 1스택(중첩) — 매 적 턴마다 스택당 (STR × ${BLOODLET_DMG_PER_STR}) 고정 피해 (DEF 무시)`,
      activationThreshold: BLOODLET_STR_THRESHOLD,
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
    {
      name: SKILL_NAMES.PRECISION,
      description: `모든 공격에 대해 적 회피 ×${PRECISION_EVASION_MULT} (비례 절반) + 최소 데미지 1+(DEX/${PRECISION_MIN_DAMAGE_STEP}) — DEX 35=최소2`,
      activationThreshold: PRECISION_DEX_THRESHOLD,
    },
    {
      name: SKILL_NAMES.SHADOW_CLONE,
      description: `매 플레이어 턴 종료 시 분신이 추가 공격 1회 (ATK의 ${SHADOW_CLONE_ATK_PCT}%)`,
      activationThreshold: SHADOW_CLONE_DEX_THRESHOLD,
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
      description: `${REGEN_INTERVAL}턴마다 HP +(VIT × ${REGEN_HP_PER_VIT}) 회복 — VIT 20=+10`,
      activationThreshold: REGEN_VIT_THRESHOLD,
    },
    {
      name: SKILL_NAMES.ENDURANCE,
      description: `전투당 1회, HP 0 이 되는 데미지를 HP 1 로 버틴다 + 최대 HP +${ENDURANCE_MAX_HP_BONUS_PCT}%`,
      activationThreshold: ENDURANCE_VIT_THRESHOLD,
    },
    {
      name: SKILL_NAMES.BULWARK,
      description: `전투 시작 시 (VIT × ${BULWARK_SHIELD_PER_VIT}) 만큼 보호막 — 받는 피해를 먼저 흡수 (회복 안 됨)`,
      activationThreshold: BULWARK_VIT_THRESHOLD,
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
    {
      name: SKILL_NAMES.LIGHTSPEED,
      description: `매 턴 마지막 공격 후 ${LIGHTSPEED_EXTRA_ATTACK_CHANCE_PCT}% 확률로 추가 1회 공격`,
      activationThreshold: LIGHTSPEED_SPD_THRESHOLD,
    },
    {
      name: SKILL_NAMES.FLURRY,
      description: `매 플레이어 턴 종료 시, 그 전투에서 받은 피해가 0이면 추가 공격 (SPD / ${FLURRY_SPD_DIVISOR})회`,
      activationThreshold: FLURRY_SPD_THRESHOLD,
    },
  ],
  luk: [
    {
      name: SKILL_NAMES.CRIT,
      description: `크리티컬 확률 +${CRIT_CHANCE_PCT}% 추가, 발동 시 데미지 ×(${CRIT_MULT_BASE} + luk × ${CRIT_MULT_PER_LUK}) — luk 20=×2.5`,
      activationThreshold: CRIT_LUK_THRESHOLD,
    },
    {
      name: SKILL_NAMES.DOUBLE_LUCK,
      description: `크리티컬 발동 시 그 전투 동안 회피 +${DOUBLE_LUCK_EVADE_BONUS}%, 크리티컬 +${DOUBLE_LUCK_CRIT_BONUS}% (누적 X)`,
      activationThreshold: DOUBLE_LUCK_LUK_THRESHOLD,
    },
    {
      name: SKILL_NAMES.BLOOM,
      description: `크리티컬 데미지 배수 +${BLOOM_CRIT_MULT_BONUS} + 크리티컬 확률 +${BLOOM_CRIT_CHANCE_BONUS_PCT}%`,
      activationThreshold: BLOOM_LUK_THRESHOLD,
    },
    {
      name: SKILL_NAMES.HEAVEN_DECREE,
      description: `모든 공격에 (LUK × ${HEAVEN_DECREE_CHANCE_PER_LUK})% 확률로 적 현재 HP의 ${HEAVEN_DECREE_HP_PCT}% 추가 고정 피해`,
      activationThreshold: HEAVEN_DECREE_LUK_THRESHOLD,
    },
  ],
};

// 현재 스탯에서 보유(획득) 스킬 목록 도출. 스킬은 별도 저장 없이 스탯에서 파생.
// "보유" ≠ "장착" — 보유한 스킬 중 일반 슬롯 수만큼만 effective.
// 1차 → 2차 → 3차 → 4차 순으로 묶어 반환 — 자동 슬롯 채움 시 낮은 티어가 우선되도록.
export function deriveSkills(stats: Record<StatKey, number>): Skill[] {
  const buckets: Skill[][] = [[], [], [], []];
  for (const k of STAT_KEYS) {
    const tiers = STAT_SKILL[k];
    for (let t = 0; t < buckets.length; t += 1) {
      const tier = tiers[t];
      if (tier && stats[k] >= tier.activationThreshold) {
        buckets[t].push({ name: tier.name, description: tier.description });
      }
    }
  }
  return buckets.flat();
}

// 보유 스킬 + 사용자 명시 선택 → 실제 발동될 스킬 이름 (일반 슬롯).
// stored 가 undefined 면 첫 slots 개 자동 장착 (신규/마이그레이션).
// stored 가 설정돼 있으면 그 값 그대로 (보유 안 한 스킬은 필터). 빈 슬롯은 빈 채로.
// slots 미지정 시 기본 슬롯 수 — 해금 반영하려면 skillLayout().normalSlots 전달.
export function effectiveSkillNames(
  available: Skill[],
  stored: string[] | undefined,
  slots: number = BASE_NORMAL_SLOTS,
): string[] {
  const availableNames = available.map((s) => s.name);
  if (stored === undefined) {
    return availableNames.slice(0, slots);
  }
  const availableSet = new Set(availableNames);
  return stored.filter((n) => availableSet.has(n)).slice(0, slots);
}

// ── 특기 (두 스탯 동시 요구) ─────────────────────────────────────────────
// STAT_SKILL(스탯당 3~4티어)과 별개 카테고리. 두 요구 스탯이 모두 FEAT_STAT_THRESHOLD
// 이상이면 보유 — 특기 전용 슬롯(skillLayout().hasFeatSlot)에 1개만 장착 가능.
export const FEAT_STAT_THRESHOLD = 25;

export const FEAT_NAMES = {
  LIFESTEAL: "흡혈",
  ACROBAT: "곡예",
  BALANCE: "천칭",
  LUCKY_SHIELD: "행운의 방패",
  BERSERKER: "광전사",
  ASSASSINATE: "암살",
  GUST_BLADE: "질풍검",
  RIPOSTE: "연참",
  SKIRMISH: "유격",
  THORN_ARMOR: "반사 갑주",
} as const;

// 흡혈 (DEX & LUK) — 크리티컬로 준 피해의 N%만큼 HP 회복.
export const LIFESTEAL_CRIT_HEAL_PCT = 30;
// 곡예 (DEX & VIT) — 회피 성공 시 HP +floor(VIT × N) 회복.
export const ACROBAT_HEAL_PER_VIT = 0.3;
// 천칭 (SPD & LUK) — 내 SPD 가 적보다 높으면 그 전투 크리티컬 확률 +floor((내SPD-적SPD) × N)%.
export const BALANCE_CRIT_PCT_PER_SPD_DIFF = 0.5;
// 행운의 방패 (VIT & LUK) — 피격당할 때마다 (LUK × N)% 확률로 그 피해를 0으로.
export const LUCKY_SHIELD_BLOCK_PCT_PER_LUK = 0.5;
// 광전사 (STR & VIT) — 잃은 HP 1%당 ATK +N%.
export const BERSERKER_ATK_PCT_PER_LOST_HP_PCT = 0.5;
// 암살 (STR & DEX) — 전투 첫 공격: 적 DEF 무시 + 데미지 ×N.
export const ASSASSINATE_DMG_MULT = 2;
// 질풍검 (STR & SPD) — 매 턴 첫 공격이 (그 턴 공격 횟수 × N) 만큼 ATK 보너스.
export const GUST_BLADE_ATK_PER_ATTACK = 1;
// 연참 (STR & LUK) — 그 턴 크리티컬 발동 시 추가 공격 N회 (턴당 1회 한정).
export const RIPOSTE_EXTRA_ATTACKS = 1;
// 유격 (DEX & SPD) — 회피 성공 시 다음 플레이어 턴 공격 횟수 +N.
export const SKIRMISH_NEXT_TURN_BONUS = 1;
// 반사 갑주 (VIT & SPD) — 피격 시 받은 HP 피해의 floor((VIT+SPD)/N)% 를 적에게 반사.
export const THORN_ARMOR_STAT_DIVISOR = 10;

export type FeatSkillInfo = {
  name: string;
  description: string;
  /** 둘 다 FEAT_STAT_THRESHOLD 이상이어야 보유. */
  req: readonly [StatKey, StatKey];
};

// 현재 엔진에 wiring 된 특기만 등재 (Phase 2/3 에서 나머지 6종 추가).
// 미구현 특기를 등재하면 장착은 되는데 효과가 없는 상태가 되므로 금지.
export const FEAT_SKILL: FeatSkillInfo[] = [
  {
    name: FEAT_NAMES.LIFESTEAL,
    description: `크리티컬로 준 피해의 ${LIFESTEAL_CRIT_HEAL_PCT}%만큼 HP 회복`,
    req: ["dex", "luk"],
  },
  {
    name: FEAT_NAMES.ACROBAT,
    description: `회피 성공 시 HP +(VIT × ${ACROBAT_HEAL_PER_VIT}) 회복 — VIT 30=+9`,
    req: ["dex", "vit"],
  },
  {
    name: FEAT_NAMES.BALANCE,
    description: `내 속도가 적보다 빠르면 그 전투 크리티컬 확률 +((내SPD−적SPD) × ${BALANCE_CRIT_PCT_PER_SPD_DIFF})%`,
    req: ["spd", "luk"],
  },
  {
    name: FEAT_NAMES.LUCKY_SHIELD,
    description: `피격당할 때마다 (LUK × ${LUCKY_SHIELD_BLOCK_PCT_PER_LUK})% 확률로 그 피해를 0으로`,
    req: ["vit", "luk"],
  },
  {
    name: FEAT_NAMES.BERSERKER,
    description: `잃은 HP 1%당 ATK +${BERSERKER_ATK_PCT_PER_LOST_HP_PCT}% (HP 절반=+25%)`,
    req: ["str", "vit"],
  },
  {
    name: FEAT_NAMES.ASSASSINATE,
    description: `전투 첫 공격 — 적 방어력 무시 + 데미지 ×${ASSASSINATE_DMG_MULT}`,
    req: ["str", "dex"],
  },
  {
    name: FEAT_NAMES.GUST_BLADE,
    description: `매 턴 첫 공격이 그 턴 공격 횟수만큼 ATK 보너스 (3회 턴=+3)`,
    req: ["str", "spd"],
  },
  {
    name: FEAT_NAMES.RIPOSTE,
    description: `그 턴 크리티컬 발동 시 추가 공격 ${RIPOSTE_EXTRA_ATTACKS}회 (턴당 1회)`,
    req: ["str", "luk"],
  },
  {
    name: FEAT_NAMES.SKIRMISH,
    description: `회피 성공 시 다음 턴 공격 횟수 +${SKIRMISH_NEXT_TURN_BONUS}`,
    req: ["dex", "spd"],
  },
  {
    name: FEAT_NAMES.THORN_ARMOR,
    description: `피격 시 받은 피해의 floor((VIT+SPD)/${THORN_ARMOR_STAT_DIVISOR})% 를 적에게 반사`,
    req: ["vit", "spd"],
  },
];

// 보유 특기 — 두 요구 스탯이 모두 FEAT_STAT_THRESHOLD 이상.
export function deriveFeats(stats: Record<StatKey, number>): Skill[] {
  return FEAT_SKILL.filter((f) =>
    f.req.every((k) => stats[k] >= FEAT_STAT_THRESHOLD),
  ).map((f) => ({ name: f.name, description: f.description }));
}

// 장착 특기 이름 — 특기 슬롯이 열려 있고, 보유 특기여야 effective. 아니면 null.
export function effectiveFeatName(
  availableFeats: Skill[],
  stored: string | undefined,
  hasFeatSlot: boolean,
): string | null {
  if (!hasFeatSlot || !stored) return null;
  return availableFeats.some((f) => f.name === stored) ? stored : null;
}

function featActive(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
  name: string,
  req: readonly [StatKey, StatKey],
): boolean {
  return (
    equipped.has(name) && req.every((k) => stats[k] >= FEAT_STAT_THRESHOLD)
  );
}

// 흡혈 — 크리티컬 데미지의 % 만큼 HP 회복. 미장착 시 0.
export function lifestealCritHealPctFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return featActive(stats, equipped, FEAT_NAMES.LIFESTEAL, ["dex", "luk"])
    ? LIFESTEAL_CRIT_HEAL_PCT
    : 0;
}

// 곡예 — 회피 성공 시 회복할 HP 절대량. 미장착 시 0.
export function acrobatEvadeHealFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return featActive(stats, equipped, FEAT_NAMES.ACROBAT, ["dex", "vit"])
    ? Math.floor(stats.vit * ACROBAT_HEAL_PER_VIT)
    : 0;
}

// 천칭 — (내SPD - 적SPD) 1당 추가되는 크리티컬 확률(%). 엔진이 적 SPD 와 비교해 적용. 미장착 시 0.
export function balanceCritPctPerSpdDiffFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return featActive(stats, equipped, FEAT_NAMES.BALANCE, ["spd", "luk"])
    ? BALANCE_CRIT_PCT_PER_SPD_DIFF
    : 0;
}

// 행운의 방패 — 피격 무효화 확률(%). 미장착 시 0.
export function luckyShieldBlockPctFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return featActive(stats, equipped, FEAT_NAMES.LUCKY_SHIELD, ["vit", "luk"])
    ? stats.luk * LUCKY_SHIELD_BLOCK_PCT_PER_LUK
    : 0;
}

// 광전사 — 잃은 HP 1%당 추가되는 ATK 비율(%). 엔진이 현재 HP 비율로 계산. 미장착 시 0.
export function berserkerAtkPctPerLostHpPctFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return featActive(stats, equipped, FEAT_NAMES.BERSERKER, ["str", "vit"])
    ? BERSERKER_ATK_PCT_PER_LOST_HP_PCT
    : 0;
}

// 암살 — 전투 첫 공격의 데미지 배수 (DEF 무시 동반). 0/미장착 = 미발동.
export function assassinateDmgMultFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return featActive(stats, equipped, FEAT_NAMES.ASSASSINATE, ["str", "dex"])
    ? ASSASSINATE_DMG_MULT
    : 0;
}

// 질풍검 — 턴 첫 공격에 (공격 횟수 × N) ATK 보너스. 미장착 시 0.
export function gustAtkPerAttackFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return featActive(stats, equipped, FEAT_NAMES.GUST_BLADE, ["str", "spd"])
    ? GUST_BLADE_ATK_PER_ATTACK
    : 0;
}

// 연참 — 크리 발동 턴 추가 공격 횟수. 미장착 시 0.
export function riposteExtraAttacksFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return featActive(stats, equipped, FEAT_NAMES.RIPOSTE, ["str", "luk"])
    ? RIPOSTE_EXTRA_ATTACKS
    : 0;
}

// 유격 — 회피 성공 시 다음 턴 공격 횟수 보너스. 미장착 시 0.
export function skirmishNextTurnBonusFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return featActive(stats, equipped, FEAT_NAMES.SKIRMISH, ["dex", "spd"])
    ? SKIRMISH_NEXT_TURN_BONUS
    : 0;
}

// 반사 갑주 — 받은 HP 피해의 % 를 적에게 반사. 미장착 시 0.
export function thornsPctFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return featActive(stats, equipped, FEAT_NAMES.THORN_ARMOR, ["vit", "spd"])
    ? Math.floor((stats.vit + stats.spd) / THORN_ARMOR_STAT_DIVISOR)
    : 0;
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
    ? Math.floor(stats.str * CRUSH_DEF_PER_STR)
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
  // 크리티컬 슬롯 시 +CRIT_CHANCE_PCT% 추가.
  const critSkillBonus =
    stats.luk >= CRIT_LUK_THRESHOLD && equipped.has(SKILL_NAMES.CRIT)
      ? CRIT_CHANCE_PCT
      : 0;
  // 만개 슬롯 시 +BLOOM_CRIT_CHANCE_BONUS_PCT% 추가 (크리티컬 슬롯 무관).
  const bloomBonus =
    stats.luk >= BLOOM_LUK_THRESHOLD && equipped.has(SKILL_NAMES.BLOOM)
      ? BLOOM_CRIT_CHANCE_BONUS_PCT
      : 0;
  return base + critSkillBonus + bloomBonus;
}

// 크리티컬 데미지 배수 — luk 비례. 만개 슬롯 시 +BLOOM_CRIT_MULT_BONUS 추가.
// 결과: luk 0=2.0 / luk 10=2.25 / luk 20=2.5 / luk 50=3.25 (만개 미장착 기준).
export function critMultFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  const base = CRIT_MULT_BASE + stats.luk * CRIT_MULT_PER_LUK;
  const bloomBonus =
    stats.luk >= BLOOM_LUK_THRESHOLD && equipped.has(SKILL_NAMES.BLOOM)
      ? BLOOM_CRIT_MULT_BONUS
      : 0;
  return base + bloomBonus;
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
    ? { interval: REGEN_INTERVAL, amount: Math.floor(stats.vit * REGEN_HP_PER_VIT) }
    : { interval: 0, amount: 0 };
}

// 처형 — 데미지 배수. 적 HP 비율은 엔진이 직접 검사하고 이 배수만 곱한다.
// 미장착 시 1 (no-op).
export function executionDamageMultFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.str >= EXECUTION_STR_THRESHOLD &&
    equipped.has(SKILL_NAMES.EXECUTION)
    ? EXECUTION_DAMAGE_MULT
    : 1;
}

// 처형 발동 임계 HP 비율 (0~1). 엔진이 적 HP / 적 max HP < 임계 일 때 처형 데미지 적용.
export function executionHpFractionFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.str >= EXECUTION_STR_THRESHOLD &&
    equipped.has(SKILL_NAMES.EXECUTION)
    ? EXECUTION_HP_FRACTION
    : 0;
}

// 정확 — 적 evasion 배수. 미장착 시 1 (no-op).
export function precisionEvasionMultFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.dex >= PRECISION_DEX_THRESHOLD &&
    equipped.has(SKILL_NAMES.PRECISION)
    ? PRECISION_EVASION_MULT
    : 1;
}

// 정확 — 플레이어 공격 최소 데미지에 더해지는 보너스(기본 floor 1 위에). 미장착 시 0.
// floor 는 1 + 이 값. DEX 35=+1(최소2) / 60=+2(최소3) / 90=+3(최소4).
export function precisionMinDamageBonusFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.dex >= PRECISION_DEX_THRESHOLD &&
    equipped.has(SKILL_NAMES.PRECISION)
    ? Math.floor(stats.dex / PRECISION_MIN_DAMAGE_STEP)
    : 0;
}

// 불굴 활성 여부 — 엔진이 HP 0 데미지 직전 분기.
export function enduranceActiveFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): boolean {
  return (
    stats.vit >= ENDURANCE_VIT_THRESHOLD &&
    equipped.has(SKILL_NAMES.ENDURANCE)
  );
}

// 불굴 max HP 보너스 % — 호출 측이 베이스 max HP 위에 곱한다.
export function enduranceMaxHpBonusPctFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return enduranceActiveFor(stats, equipped) ? ENDURANCE_MAX_HP_BONUS_PCT : 0;
}

// 광속 — 매 턴 마지막 공격 후 추가 1회 공격 확률(%).
export function lightspeedExtraAttackPctFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.spd >= LIGHTSPEED_SPD_THRESHOLD &&
    equipped.has(SKILL_NAMES.LIGHTSPEED)
    ? LIGHTSPEED_EXTRA_ATTACK_CHANCE_PCT
    : 0;
}

// ── 4티어 발동 헬퍼 ─────────────────────────────────────────────────────
// 출혈 — 출혈 스택당 적이 받는 고정 피해. 미장착 시 0.
export function bleedDmgPerStackFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.str >= BLOODLET_STR_THRESHOLD &&
    equipped.has(SKILL_NAMES.BLOODLET)
    ? Math.floor(stats.str * BLOODLET_DMG_PER_STR)
    : 0;
}

// 그림자 분신 — 매 턴 끝 분신 추가타의 ATK 비율(%). 미장착 시 0.
export function shadowCloneAtkPctFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.dex >= SHADOW_CLONE_DEX_THRESHOLD &&
    equipped.has(SKILL_NAMES.SHADOW_CLONE)
    ? SHADOW_CLONE_ATK_PCT
    : 0;
}

// 철벽 — 전투 시작 시 보호막 절대량. 미장착 시 0.
export function bulwarkShieldFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.vit >= BULWARK_VIT_THRESHOLD && equipped.has(SKILL_NAMES.BULWARK)
    ? Math.floor(stats.vit * BULWARK_SHIELD_PER_VIT)
    : 0;
}

// 무피해 난무 — 무피해 시 매 턴 끝 추가 공격 횟수. 미장착 시 0.
export function flurryAttacksFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.spd >= FLURRY_SPD_THRESHOLD && equipped.has(SKILL_NAMES.FLURRY)
    ? Math.floor(stats.spd / FLURRY_SPD_DIVISOR)
    : 0;
}

// 천명 — 매 공격마다 적 현재 HP 비율 피해가 터질 확률(%). 미장착 시 0.
export function heavenDecreeChancePctFor(
  stats: Record<StatKey, number>,
  equipped: ReadonlySet<string>,
): number {
  return stats.luk >= HEAVEN_DECREE_LUK_THRESHOLD &&
    equipped.has(SKILL_NAMES.HEAVEN_DECREE)
    ? stats.luk * HEAVEN_DECREE_CHANCE_PER_LUK
    : 0;
}
