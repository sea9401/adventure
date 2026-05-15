// 고탑 주간 최고층 추적 (Phase 2 랭킹용).
//
// tower.v1 (run-state, write-heavy) 와 분리 — 이쪽은 fight_floor 승리 시점에만 갱신.
// week 경계는 KST 월요일 00:00 — 기존 길드 주간 cron 과 동일 규칙.
//
// 백분위 칭호는 매주 마감 시 cron (`/api/cron/tower-weekly-cycle`) 이
// lastWeekStart 매칭 기록을 batch 처리해 부여. 클라/실시간 부여 X.

export const TOWER_WEEKLY_STORAGE_KEY = "tower-weekly.v1";

export type TowerWeekly = {
  /** 이번 주 (weekStartedAt 기준) 도달한 최고층. */
  weekHighest: number;
  /** 주 시작일 — "YYYY-MM-DD" (KST 월요일). 비교용 키. */
  weekStartedAt: string;
};

/** 자격 최소선 — F30 이상만 백분위 칭호 후보 (보스 3회 클리어). */
export const TOWER_WEEKLY_MIN_FLOOR = 30;

/** 현재 KST 주 시작일을 "YYYY-MM-DD" 키로. */
export function kstWeekStartKey(now: Date = new Date()): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const day = kstNow.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const kstMonday = new Date(kstNow);
  kstMonday.setUTCDate(kstNow.getUTCDate() - daysSinceMonday);
  kstMonday.setUTCHours(0, 0, 0, 0);
  // KST 가 아닌 UTC YMD 가 아니라 KST YMD 가 필요 — kstMonday 는 KST 0시이지만
  // UTC 로 보면 같은 객체가 (KST 월) 00:00 = (UTC 일) 15:00. UTC 좌표로 추출하면
  // 어느 쪽도 YMD 가 같다 (UTC 일 15:00 → UTC 일 = KST 월 자정의 직전 — 의도와 다름).
  // 안전하게 +9h 한 좌표에서 ISO date 만 잘라낸다.
  const kstDate = new Date(kstMonday.getTime() + KST_OFFSET_MS);
  return kstDate.toISOString().slice(0, 10);
}

/** 지난 주 시작일 — cron 이 결과 집계 시 사용. */
export function lastWeekStartKey(now: Date = new Date()): string {
  const last = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return kstWeekStartKey(last);
}

/**
 * tower-weekly.v1 갱신 — lazy reset 포함.
 *   - 기록의 weekStartedAt 가 현 주와 다르면 weekHighest=0 으로 리셋
 *   - candidateFloor 가 그 후의 weekHighest 보다 크면 갱신
 * 변경이 없으면 null 반환 (호출자가 IO skip).
 */
export function updateTowerWeekly(
  prev: TowerWeekly | null,
  candidateFloor: number,
  now: Date = new Date(),
): TowerWeekly | null {
  const currentWeek = kstWeekStartKey(now);
  const baseHighest =
    prev && prev.weekStartedAt === currentWeek ? prev.weekHighest : 0;
  if (candidateFloor <= baseHighest && prev?.weekStartedAt === currentWeek) {
    return null;
  }
  return {
    weekHighest: Math.max(baseHighest, candidateFloor),
    weekStartedAt: currentWeek,
  };
}
