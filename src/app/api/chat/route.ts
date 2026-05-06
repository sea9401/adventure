import { kv } from "@vercel/kv";
import * as Sentry from "@sentry/nextjs";
import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";

const KEY = "chat:messages";
const MAX_MESSAGES = 50;
const MAX_NICK_LEN = 20;
const MAX_TEXT_LEN = 200;

// 채팅 스팸 방지: 분당 IP당 10회
const CHAT_RATE_LIMIT = 10;
const CHAT_RATE_WINDOW_MS = 60_000;

type Message = {
  nickname: string;
  text: string;
  at: number;
};

const hasKv = () => !!process.env.KV_REST_API_URL;

export async function GET() {
  if (!hasKv()) {
    return Response.json({ messages: [], disabled: true });
  }
  try {
    const items = (await kv.lrange<Message>(KEY, 0, MAX_MESSAGES - 1)) ?? [];
    return Response.json({ messages: items.reverse() });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/chat", method: "GET" } });
    const msg = err instanceof Error ? err.message : "unknown";
    return Response.json({ messages: [], error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!hasKv()) {
    return Response.json({ error: "chat disabled" }, { status: 503 });
  }
  const ip = getClientIp(req);
  const rl = await rateLimit(`chat:${ip}`, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS);
  if (!rl.allowed) {
    return tooManyRequests(rl.resetAt);
  }
  try {
    const body = (await req.json()) as { nickname?: string; text?: string };
    const nickname = (body.nickname ?? "").trim().slice(0, MAX_NICK_LEN);
    const text = (body.text ?? "").trim().slice(0, MAX_TEXT_LEN);
    if (!nickname || !text) {
      return Response.json({ error: "missing fields" }, { status: 400 });
    }
    const msg: Message = { nickname, text, at: Date.now() };
    await kv.lpush(KEY, msg);
    await kv.ltrim(KEY, 0, MAX_MESSAGES - 1);
    return Response.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/chat", method: "POST" } });
    const m = err instanceof Error ? err.message : "unknown";
    return Response.json({ error: m }, { status: 500 });
  }
}
