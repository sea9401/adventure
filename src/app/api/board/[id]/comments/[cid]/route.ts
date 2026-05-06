// DELETE /api/board/[id]/comments/[cid] — 댓글 삭제 (작성자 본인)

import * as Sentry from "@sentry/nextjs";

import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { hasKv, hashIp, removeCommentFromPost } from "@/lib/board/storage";

export const runtime = "nodejs";

const DELETE_RATE_LIMIT = 10;
const DELETE_RATE_WINDOW_MS = 60_000;

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; cid: string }> }) {
  if (!hasKv()) return Response.json({ error: "board disabled" }, { status: 503 });
  const { id, cid } = await ctx.params;
  const ip = getClientIp(req);
  const rl = await rateLimit(`board:cmt-del:${ip}`, DELETE_RATE_LIMIT, DELETE_RATE_WINDOW_MS);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const updated = await removeCommentFromPost(id, cid, hashIp(ip));
    if (!updated) return Response.json({ error: "forbidden or not found" }, { status: 404 });
    return Response.json({ post: updated });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "/api/board/[id]/comments/[cid]", method: "DELETE" },
    });
    return Response.json({ error: "server" }, { status: 500 });
  }
}
