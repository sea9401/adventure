import { kv } from "@vercel/kv";
import * as Sentry from "@sentry/nextjs";
import { readGlobalStats, type GlobalStats } from "@/lib/metrics";

export const runtime = "nodejs";

const CACHE_KEY = "stats:cache:global";
const CACHE_TTL_SEC = 60 * 60; // 1시간

const hasKv = () => !!process.env.KV_REST_API_URL;

export async function GET() {
  if (!hasKv()) {
    return Response.json(
      { totalPlayers: 0, dau: 0, newToday: 0, topBossKills: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const cached = await kv.get<GlobalStats>(CACHE_KEY);
    if (cached) {
      return Response.json(cached);
    }
    const stats = await readGlobalStats();
    await kv.set(CACHE_KEY, stats, { ex: CACHE_TTL_SEC });
    return Response.json(stats);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/stats/global" } });
    return Response.json(
      { totalPlayers: 0, dau: 0, newToday: 0, topBossKills: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
