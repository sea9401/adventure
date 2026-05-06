// POST /api/board/[id]/report — 신고 (관리자 큐에 기록 + 글 신고 카운트 증가)

import * as Sentry from "@sentry/nextjs";

import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { hasKv, incrementReport } from "@/lib/board/storage";

export const runtime = "nodejs";

const REPORT_RATE_LIMIT = 5;
const REPORT_RATE_WINDOW_MS = 60 * 60 * 1000; // 1시간

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasKv()) return Response.json({ error: "board disabled" }, { status: 503 });
  const { id } = await ctx.params;
  const ip = getClientIp(req);
  const rl = await rateLimit(`board:report:${ip}`, REPORT_RATE_LIMIT, REPORT_RATE_WINDOW_MS);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const updated = await incrementReport(id);
    if (!updated) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true, reportCount: updated.reportCount });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "/api/board/[id]/report", method: "POST" },
    });
    return Response.json({ error: "server" }, { status: 500 });
  }
}
