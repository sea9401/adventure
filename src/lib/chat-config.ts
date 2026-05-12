// 채팅 메시지 제약 — 클라/서버 공통.
export const CHAT_MAX_LENGTH = 200;
export const CHAT_RATE_LIMIT_MS = 2000;
export const CHAT_FETCH_LIMIT = 50;
export const CHAT_RETENTION_DAYS = 3;

// 시스템/협동 알림 메시지의 className — 일반 채팅과 같은 messages 테이블에 들어오지만
// 채팅창에서는 별도 탭으로 분리해서 보여준다 (협동 보스 스폰/토벌 알림 등).
export const NOTICE_CLASS_NAMES = ["협동 보스", "협동 토벌"] as const;

export function isNoticeMessage(m: { className: string }): boolean {
  return (NOTICE_CLASS_NAMES as readonly string[]).includes(m.className);
}
