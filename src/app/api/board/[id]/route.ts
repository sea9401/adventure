// GET    /api/board/[id]  — 단일 게시글 (댓글 포함)
// PATCH  /api/board/[id]  — 본문/제목 수정 (작성자 본인)
// DELETE /api/board/[id]  — 삭제 (작성자 본인)

import * as Sentry from "@sentry/nextjs";

import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { getPost, hasKv, hashIp, removePostFromList, savePost } from "@/lib/board/storage";
import { BOARD_BODY_MAX, BOARD_TITLE_MAX, type BoardPost } from "@/lib/board/types";

export const runtime = "nodejs";

const EDIT_RATE_LIMIT = 10;
const EDIT_RATE_WINDOW_MS = 60_000;
const DELETE_RATE_LIMIT = 5;
const DELETE_RATE_WINDOW_MS = 60_000;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!hasKv()) return Response.json({ post: null, disabled: true });
  try {
    const post = await getPost(id);
    if (!post) return Response.json({ post: null }, { status: 404 });
    return Response.json({ post });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/board/[id]", method: "GET" } });
    return Response.json({ post: null, error: "server" }, { status: 500 });
  }
}

const sanitizeText = (raw: unknown, max: number): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return null;
  return trimmed;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasKv()) return Response.json({ error: "board disabled" }, { status: 503 });
  const { id } = await ctx.params;
  const ip = getClientIp(req);
  const rl = await rateLimit(`board:edit:${ip}`, EDIT_RATE_LIMIT, EDIT_RATE_WINDOW_MS);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const title = sanitizeText(input.title, BOARD_TITLE_MAX);
  const text = sanitizeText(input.body, BOARD_BODY_MAX);
  if (!title || !text) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  try {
    const post = await getPost(id);
    if (!post) return Response.json({ error: "not found" }, { status: 404 });
    if (post.ipHash !== hashIp(ip)) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const updated: BoardPost = { ...post, title, body: text, updatedAt: Date.now() };
    await savePost(updated);
    return Response.json({ post: updated });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/board/[id]", method: "PATCH" } });
    return Response.json({ error: "server" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!hasKv()) return Response.json({ error: "board disabled" }, { status: 503 });
  const { id } = await ctx.params;
  const ip = getClientIp(req);
  const rl = await rateLimit(`board:del:${ip}`, DELETE_RATE_LIMIT, DELETE_RATE_WINDOW_MS);
  if (!rl.allowed) return tooManyRequests(rl.resetAt);

  try {
    const post = await getPost(id);
    if (!post) return Response.json({ error: "not found" }, { status: 404 });
    if (post.ipHash !== hashIp(ip)) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    await removePostFromList(id);
    return Response.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/board/[id]", method: "DELETE" } });
    return Response.json({ error: "server" }, { status: 500 });
  }
}
