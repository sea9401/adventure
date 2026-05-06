// GET  /api/board       — 최신 N개 목록 (list view)
// POST /api/board       — 새 게시글 작성

import * as Sentry from "@sentry/nextjs";

import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { hasKv, hashIp, listPosts, newPostId, pushNewPost, toListItem } from "@/lib/board/storage";
import {
  BOARD_BODY_MAX,
  BOARD_NICKNAME_MAX,
  BOARD_TITLE_MAX,
  type BoardListItem,
  type BoardPost,
} from "@/lib/board/types";

export const runtime = "nodejs";

const POST_RATE_LIMIT = 5;
const POST_RATE_WINDOW_MS = 60 * 60 * 1000; // 1시간

export async function GET() {
  if (!hasKv()) {
    return Response.json({ posts: [] as BoardListItem[], disabled: true });
  }
  try {
    const posts = await listPosts();
    return Response.json({ posts: posts.map(toListItem) });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/board", method: "GET" } });
    return Response.json({ posts: [] as BoardListItem[], error: "server" }, { status: 500 });
  }
}

const sanitizeText = (raw: unknown, max: number): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return null;
  return trimmed;
};

const sanitizeNickname = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > BOARD_NICKNAME_MAX) return null;
  return trimmed;
};

export async function POST(req: Request) {
  if (!hasKv()) {
    return Response.json({ error: "board disabled" }, { status: 503 });
  }
  const ip = getClientIp(req);
  const rl = await rateLimit(`board:post:${ip}`, POST_RATE_LIMIT, POST_RATE_WINDOW_MS);
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
  const nickname = sanitizeNickname(input.nickname);
  if (!title || !text || !nickname) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const post: BoardPost = {
    id: newPostId(),
    title,
    body: text,
    nickname,
    ipHash: hashIp(ip),
    at: Date.now(),
    comments: [],
    reportCount: 0,
  };

  try {
    await pushNewPost(post);
    return Response.json({ post });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/board", method: "POST" } });
    return Response.json({ error: "server" }, { status: 500 });
  }
}
