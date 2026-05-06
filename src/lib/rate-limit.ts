import { kv } from "@vercel/kv";

const hasKv = () => !!process.env.KV_REST_API_URL;

// 인메모리 fallback (KV 없을 때 단일 인스턴스에서만 동작)
const memCounters = new Map<string, { count: number; resetAt: number }>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms
};

/**
 * 슬라이딩 카운터 기반 rate limiter.
 * - 같은 key가 windowMs 안에 limit번을 초과하면 차단
 * - KV가 있으면 KV에 저장 (다중 인스턴스 / Edge에서도 동작)
 * - 없으면 메모리 (개발 / 단일 컨테이너)
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const bucket = `rl:${key}:${Math.floor(now / windowMs)}`;
  const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;

  if (hasKv()) {
    try {
      const count = await kv.incr(bucket);
      if (count === 1) {
        // 첫 hit에 TTL 설정
        await kv.expire(bucket, Math.ceil(windowMs / 1000));
      }
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt,
      };
    } catch {
      // KV 장애 시 fallback to memory
    }
  }

  const entry = memCounters.get(bucket);
  if (!entry || entry.resetAt <= now) {
    memCounters.set(bucket, { count: 1, resetAt });
    // 단순 청소: 1000개 넘으면 전체 비우기
    if (memCounters.size > 1000) memCounters.clear();
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

/** Request에서 client IP 추출 (Vercel / 일반 헤더) */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/** 429 응답 헬퍼 */
export function tooManyRequests(resetAt: number): Response {
  return Response.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))),
      },
    },
  );
}
