// DELETE /api/admin/board/[id] — 관리자가 게시글 강제 삭제 + 신고 큐에서도 제거

import { kv } from "@vercel/kv";
import * as Sentry from "@sentry/nextjs";

import { hasKv, removePostFromList, REPORTS_KEY } from "@/lib/board/storage";

export const runtime = "nodejs";

const verifyAdmin = (req: Request): boolean => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const expected = process.env.ADMIN_KEY;
  return !!expected && key === expected;
};

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasKv()) {
    return Response.json({ error: "board disabled" }, { status: 503 });
  }
  const { id } = await ctx.params;
  try {
    await removePostFromList(id);
    await kv.lrem(REPORTS_KEY, 0, id);
    return Response.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "/api/admin/board/[id]", method: "DELETE" },
    });
    return Response.json({ error: "server" }, { status: 500 });
  }
}
