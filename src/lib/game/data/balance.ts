// 환경별 밸런스 분기 — dev / NEXT_PUBLIC_TEST_MODE=1 → 테스트값, prod → 정상값
const TEST_MODE =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_TEST_MODE === "1" || process.env.NODE_ENV !== "production");

export const BOSS_DURATION_SEC = 30; // 최대 턴 수 (실제 탐험 시간 = 실제 턴 × 1초)
export const BOSS_COOLDOWN_MS = TEST_MODE ? 60_000 : 15 * 60_000; // 테스트 1분 / 운영 15분
export const BOSS_REWARD_MULT = 1;
export const expForLevel = (level: number): number => {
  if (level < 100) return level * 50;
  return Math.floor(level * 50 * (1 + (level - 100) / 15));
};

export const DISPATCH_DURATIONS = [60, 1800, 7200] as const;
export type DispatchDuration = (typeof DISPATCH_DURATIONS)[number];

// 짧게 반복할수록 효율 우대 — 활성 플레이 손맛. 1분→2시간 25% 페널티.
export const DISPATCH_REWARD_MULT: Record<DispatchDuration, number> = {
  60: 1.0,
  1800: 0.88,
  7200: 0.75,
};

// 보물 굴림 단위 — durationSec / TREASURE_ROLL_PERIOD_SEC 회 독립 시행.
// 길이별 보물 효율 곡선이 per-kill(DISPATCH_REWARD_MULT)과 일치하도록 분당 1회로 설계.
export const TREASURE_ROLL_PERIOD_SEC = 60;

export const SPD_EXTRA_ATTACK_RATE = 0.05;
export const AGI_DODGE_RATE = 0.002;
export const AGI_DODGE_CAP = 0.6;
export const AGI_CRIT_RATE = 0.001;
export const AGI_CRIT_CAP = 0.3;
export const LEVEL_CAP = 100;
export const ADVANCED_LEVEL_CAP = 150;
export const DOT_BASE_INT_MULT = 0.5;
export const DOT_STACK_CAP = 5;

// === 원소술사 (24-elementalist-concept-redesign-plan.md) ===
export const ELEMENT_STACK_CAP = 3;
export const ELEMENT_LINGER_TURNS = 3;

export const TEST_REWARD_MULT = TEST_MODE ? 3 : 1;

// 건물 이코노미 — Lv 25 명전과 별개의 건물별 산출/회복.
// 활성 사냥 우대 정체성 강화를 위해 영지 산출량을 이전 값의 25%로 하향 (이전 0.45/0.25/0.4).
// mid-tier 사냥(설원~해적 정박지) 대비 1시간 사냥 ≈ 영지 1~3일치로 조정.
// 숙소 HP 회복은 자원이 아니라 그대로 유지.
export const FARM_GOLD_PER_SEC = (lv: number) => lv * 0.1125;
export const MINE_IRON_PER_SEC = (lv: number) => lv * 0.0625;
export const HP_REGEN_PER_SEC = (innLv: number) => 0.25 + innLv * 0.375;
export const TRAINING_EXP_PER_SEC = (lv: number) => lv * 0.1;
