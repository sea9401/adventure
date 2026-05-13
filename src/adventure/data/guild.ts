// 유저 자치 길드 시스템의 상수 / 검증 유틸. 서버 + 클라이언트 양쪽에서 쓴다.
// 정책 변경(정원, 쿨다운, 이름 길이 등) 은 여기서 한 곳에서.

export const GUILD_MAX_MEMBERS = 3;

// 생성 조건 — 둘 중 하나만 만족해도 OK.
export const GUILD_CREATE_LEVEL = 5;
export const GUILD_CREATE_QUEST_COUNT = 5;
export const GUILD_CREATE_GOLD = 200;

// 시간 정책.
export const GUILD_LEAVE_COOLDOWN_DAYS = 1;
export const GUILD_INVITE_EXPIRES_DAYS = 7;
export const GUILD_JOIN_REQUEST_EXPIRES_DAYS = 7;
export const GUILD_DISBANDED_NAME_HOLD_DAYS = 30;
export const GUILD_INACTIVITY_DAYS = 30; // Phase 2 — 30일 미접속 자동 해체/위임

// 이름 정책.
export const GUILD_NAME_MIN = 2;
export const GUILD_NAME_MAX = 12;

// 소개글 — 마스터가 자유롭게 적는 짧은 한 줄. 빈 문자열 = 미설정.
export const GUILD_DESCRIPTION_MAX = 120;
const GUILD_NAME_REGEX = /^[\p{L}\p{N} ]+$/u;
const GUILD_NAME_BANNED_WORDS = ["운영자", "관리자", "admin", "system"];

export type GuildNameValidation =
  | { ok: true; trimmed: string }
  | { ok: false; reason: string };

export function validateGuildName(raw: string): GuildNameValidation {
  const trimmed = raw.trim();
  if (trimmed.length < GUILD_NAME_MIN || trimmed.length > GUILD_NAME_MAX) {
    return {
      ok: false,
      reason: `길드명은 ${GUILD_NAME_MIN}~${GUILD_NAME_MAX}자 범위입니다.`,
    };
  }
  if (!GUILD_NAME_REGEX.test(trimmed)) {
    return { ok: false, reason: "한글/영문/숫자/공백만 사용할 수 있습니다." };
  }
  const lower = trimmed.toLowerCase();
  if (GUILD_NAME_BANNED_WORDS.some((w) => lower.includes(w))) {
    return { ok: false, reason: "사용할 수 없는 단어가 포함되어 있습니다." };
  }
  return { ok: true, trimmed };
}

export type GuildRole = "master" | "member";
