// GET /api/admin/board/reports — 신고된 게시글 목록 (관리자 전용)
//
// 기존 admin 라우트(grant 등)와 동일한 인증 패턴: ADMIN_KEY env + adminKey 쿼리/바디.

import { kv } from "@vercel/kv";
import * as Sentry from "@sentry/nextjs";

import { hasKv, POST_KEY, REPORTS_KEY } from "@/lib/board/storage";
import type { BoardPost } from "@/lib/board/types";

export const runtime = "nodejs";

const verifyAdmin = (req: Request): boolean => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const expected = process.env.ADMIN_KEY;
  return !!expected && key === expected;
};

export async function GET(req: Request) {
  if (!verifyAdmin(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasKv()) {
    return Response.json({ posts: [], disabled: true });
  }
  try {
    const ids = (await kv.lrange<string>(REPORTS_KEY, 0, 99)) ?? [];
    const posts = await Promise.all(ids.map((id) => kv.get<BoardPost>(POST_KEY(id))));
    const out = posts.filter((p): p is BoardPost => p != null);
    return Response.json({ posts: out });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "/api/admin/board/reports", method: "GET" },
    });
    return Response.json({ posts: [], error: "server" }, { status: 500 });
  }
}
