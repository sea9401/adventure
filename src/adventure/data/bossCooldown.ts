// 보스 도전 쿨다운 — 일일 도전 횟수에 따라 누진. 자정에 횟수·쿨타임 모두 초기화.
//
// 정책:
//   1~3회차 → 직후 15분 쿨다운
//   4~6회차 → 직후 30분
//   7~9회차 → 직후 1시간
//   10회+   → 직후 3시간
// (즉 "방금 친 N번째 도전" 직후의 대기 시간. N=0 — 아직 한 번도 안 침 — 은 0.)
//
// 길드 버프 boss_attempt (boss_cooldown_reduction_pct) 가 위 베이스 쿨에 곱셈으로
// 적용. 1~50% 감소. 음수/100 이상은 clamp.

const MIN_MS = 60_000;
const COOLDOWN_TIERS_MIN: readonly { threshold: number; minutes: number }[] = [
  { threshold: 3, minutes: 15 },
  { threshold: 6, minutes: 30 },
  { threshold: 9, minutes: 60 },
  { threshold: Infinity, minutes: 180 },
] as const;

// 방금 친 attemptCount 번째 도전 직후 대기해야 할 ms.
// attemptCount = 1 이면 첫 도전 후 → 15분.
// attemptCount = 0 이면 아직 한 번도 안 침 → 0 (즉시 도전 가능).
export function cooldownAfterAttempt(
  attemptCount: number,
  reductionPct: number = 0,
): number {
  if (attemptCount <= 0) return 0;
  const baseMinutes = COOLDOWN_TIERS_MIN.find(
    (t) => attemptCount <= t.threshold,
  )!.minutes;
  const clamped = Math.max(0, Math.min(99, reductionPct));
  return Math.round(baseMinutes * MIN_MS * (1 - clamped / 100));
}

// 다음 도전 시점 ms (epoch). lastAttemptAt 가 undefined / 자정 지나서 reset 된 경우
// 호출 측에서 0 / null 을 넘기면 항상 즉시 가능 (Date.now() 보다 작은 값 반환).
export function nextAttemptAt(
  lastAttemptAtMs: number | null,
  attemptCount: number,
  reductionPct: number = 0,
): number {
  if (lastAttemptAtMs == null || attemptCount <= 0) return 0;
  return lastAttemptAtMs + cooldownAfterAttempt(attemptCount, reductionPct);
}

// 표시용 — "12분 34초" / "1시간 20분" / "5초" 식 짧은 라벨.
export function formatCooldownRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return "0초";
  const totalSec = Math.ceil(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}
