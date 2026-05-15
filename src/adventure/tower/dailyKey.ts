// 고탑 일일 시도 캡 리셋 기준 — KST 자정. 클라/서버 양쪽이 같은 함수로 비교해야
// 자정 직후 클라의 "오늘 시도" 표시와 서버의 todayDaily 리셋이 일치한다.
// (server compute.ts 도 같은 구현을 re-export — single source of truth.)

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "YYYY-MM-DD" — KST 기준. */
export function todayKey(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
