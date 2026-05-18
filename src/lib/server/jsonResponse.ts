import "server-only";

// API 라우트 응답 헬퍼 — 응답 shape 표준화.
// 기존 라우트는 Response.json() / new Response() 를 혼용해 status code / body shape 가 라우트마다
// 다르다. 새 라우트는 이 헬퍼로 일관된 { ok: true, ...data } / { ok: false, error } 형태를 쓴다.

export function jsonOk<T extends Record<string, unknown>>(data: T): Response {
  return Response.json({ ok: true, ...data });
}

export function jsonError(
  code: string,
  status = 400,
  extra?: Record<string, unknown>,
): Response {
  return Response.json({ ok: false, error: code, ...(extra ?? {}) }, { status });
}
