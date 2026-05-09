// 유저 간 쪽지(`marketplace_inbox.kind = 'user_message'`) 의 길이/속도 제한.
// 시스템 발송분(거래 결과 등)에는 적용되지 않는다.
export const USER_MESSAGE_MAX_LENGTH = 200;
export const USER_MESSAGE_RATE_LIMIT_MS = 30_000; // 마지막 발송 후 30초 대기
export const USER_MESSAGE_DAILY_CAP = 50; // 24시간 누적 발송 한도
