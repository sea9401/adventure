"use client";

// 디바이스별 고유 ID — 단일 세션 enforce 의 토큰. localStorage 에 박혀 같은 브라우저
// 안에서는 모든 탭이 공유한다. 다른 디바이스/브라우저는 자기 localStorage 가 비어
// 있어 새 UUID 를 만들고, /api/session/claim 으로 서버 users.activeSessionId 를 덮어쓰면
// 그 사용자의 다음 PATCH/GET (X-Session-Id 동봉) 은 410 으로 거절된다.
//
// SaveProvider 가 핵심 호출자(부트스트랩 시 createOrGet → claim) 이고, 자동 사냥
// (/api/hunt/*) 같은 다른 변경성 엔드포인트도 같은 토큰을 헤더로 동봉해야 단일 세션
// 보호망에 들어간다. 그래서 이 헬퍼를 별도 모듈로 빼서 공유한다.
export const DEVICE_SESSION_KEY = "device-session-id.v1";

const MAX_LEN = 100;

function makeFreshId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * localStorage 에 토큰이 있으면 그대로, 없으면 새로 만들어 박고 반환.
 * SaveProvider 처럼 "이 디바이스를 활성 세션으로 claim 할 권한이 있다" 는
 * 부트스트랩 경로에서 사용. 일반 변경성 호출은 readDeviceSessionId 로 충분.
 */
export function getOrCreateDeviceSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(DEVICE_SESSION_KEY);
    if (existing && existing.length > 0 && existing.length <= MAX_LEN) {
      return existing;
    }
  } catch {}
  const fresh = makeFreshId();
  try {
    localStorage.setItem(DEVICE_SESSION_KEY, fresh);
  } catch {}
  return fresh;
}

/**
 * 토큰이 이미 있으면 반환, 없으면 빈 문자열. 새로 만들지 않음 — 헤더 동봉용.
 * SaveProvider 부트스트랩 전 호출되면 "" 가 나가지만, checkSession 이 빈 헤더는
 * 통과시켜서 무해. 부트스트랩 직후엔 다른 호출자도 같은 토큰을 보게 된다.
 */
export function readDeviceSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(DEVICE_SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}
