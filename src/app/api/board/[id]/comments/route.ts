// POST /api/board/[id]/comments — 댓글 추가

import * as Sentry from "@sentry/nextjs";

import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { addCommentToPost, getPost, hasKv, hashIp, newCommentId } from "@/lib/board/storage";
import {
  BOARD_COMMENT_MAX,
  BOARD_COMMENTS_PER_POST_CAP,
  BOARD_NICKNAME_MAX,
  type BoardComment,
} from "@/lib/board/types";

export const runtime = "nodejs";

const COMMENT_RATE_LIMIT = 10;
const COMMENT_RATE_WINDOW_MS = 60_000;

const sanitize = (raw: unknown, max: number): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return null;
  return trimmed;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasKv()) return Response.json({ error: "board disabled" }, { status: 503 });
  const { id } = await ctx.params;
  const ip = getClientIp(req);
  const rl = await rateLimit(`board:cmt:${ip}`, COMMENT_RATE_LIMIT, COMMENT_RATE_WINDOW_MS);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const text = sanitize(input.body, BOARD_COMMENT_MAX);
  const nickname = sanitize(input.nickname, BOARD_NICKNAME_MAX);
  if (!text || !nickname) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  try {
    const existing = await getPost(id);
    if (!existing) return Response.json({ error: "not found" }, { status: 404 });
    if ((existing.comments?.length ?? 0) >= BOARD_COMMENTS_PER_POST_CAP) {
      return Response.json({ error: "comments full" }, { status: 400 });
    }
    const comment: BoardComment = {
      id: newCommentId(),
      body: text,
      nickname,
      ipHash: hashIp(ip),
      at: Date.now(),
    };
    const updated = await addCommentToPost(id, comment);
    return Response.json({ post: updated });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "/api/board/[id]/comments", method: "POST" },
    });
    return Response.json({ error: "server" }, { status: 500 });
  }
}
