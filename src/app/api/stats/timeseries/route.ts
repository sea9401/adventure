import * as Sentry from "@sentry/nextjs";
import { readTimeseries, type TimeseriesMetric } from "@/lib/metrics";

export const runtime = "nodejs";

const VALID: TimeseriesMetric[] = ["dau", "new_players", "boss_kills"];

export async function GET(req: Request) {
  const expected = process.env.ADMIN_KEY;
  const provided = req.headers.get("x-admin-key");
  if (!expected || provided !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const metric = url.searchParams.get("metric") as TimeseriesMetric | null;
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days") ?? 30)));
    if (!metric || !VALID.includes(metric)) {
      return Response.json(
        { error: `metric은 ${VALID.join(", ")} 중 하나여야 합니다` },
        { status: 400 },
      );
    }
    const points = await readTimeseries(metric, days);
    return Response.json({ metric, days, points });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/stats/timeseries" } });
    const m = err instanceof Error ? err.message : "unknown";
    return Response.json({ error: m }, { status: 500 });
  }
}
