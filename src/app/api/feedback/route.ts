import { kv } from "@vercel/kv";
import * as Sentry from "@sentry/nextjs";
import { createHash, randomUUID } from "node:crypto";
import { rateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import type { FeedbackEntry, FeedbackInput } from "@/lib/feedback";

export const runtime = "nodejs";

const LIST_KEY = "feedback:list";
const ITEM_KEY = (id: string) => `feedback:item:${id}`;
const MAX_TEXT = 1000;
const MAX_CONTACT = 100;
const MAX_LIST = 1000;

const FEEDBACK_RATE_LIMIT = 3;
const FEEDBACK_RATE_WINDOW_MS = 60_000;

const hasKv = () => !!process.env.KV_REST_API_URL;

const hashIp = (ip: string): string => {
  const salt = process.env.IP_SALT ?? "default-salt-change-me";
  return createHash("sha256")
    .update(ip + salt)
    .digest("hex")
    .slice(0, 16);
};

const sanitize = (raw: unknown): FeedbackInput | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const typeIn = o.type;
  const type =
    typeIn === "bug" || typeIn === "suggestion" || typeIn === "general" ? typeIn : "general";
  const text = typeof o.text === "string" ? o.text.trim().slice(0, MAX_TEXT) : "";
  if (!text) return null;
  const contact =
    typeof o.contact === "string" && o.contact.trim()
      ? o.contact.trim().slice(0, MAX_CONTACT)
      : undefined;
  const ctx =
    o.context && typeof o.context === "object" ? (o.context as Record<string, unknown>) : {};
  const context = {
    nickname: typeof ctx.nickname === "string" ? ctx.nickname.slice(0, 30) : undefined,
    level: typeof ctx.level === "number" ? Math.floor(ctx.level) : undefined,
    className: typeof ctx.className === "string" ? ctx.className.slice(0, 30) : undefined,
    tab: typeof ctx.tab === "string" ? ctx.tab.slice(0, 30) : undefined,
    version: typeof ctx.version === "string" ? ctx.version.slice(0, 20) : undefined,
    userAgent: typeof ctx.userAgent === "string" ? ctx.userAgent.slice(0, 200) : undefined,
  };
  return { type, text, contact, context };
};

export async function POST(req: Request) {
  if (!hasKv()) {
    return Response.json({ error: "feedback disabled" }, { status: 503 });
  }
  const ip = getClientIp(req);
  const rl = await rateLimit(`fb:${ip}`, FEEDBACK_RATE_LIMIT, FEEDBACK_RATE_WINDOW_MS);
  if (!rl.allowed) {
    return tooManyRequests(rl.resetAt);
  }
  try {
    const body = await req.json();
    const input = sanitize(body);
    if (!input) {
      return Response.json({ error: "invalid input" }, { status: 400 });
    }
    const entry: FeedbackEntry = {
      id: randomUUID(),
      at: Date.now(),
      type: input.type,
      text: input.text,
      contact: input.contact,
      context: input.context,
      ipHash: hashIp(ip),
      status: "new",
    };
    await kv.set(ITEM_KEY(entry.id), entry);
    await kv.lpush(LIST_KEY, entry.id);
    await kv.ltrim(LIST_KEY, 0, MAX_LIST - 1);
    return Response.json({ ok: true, id: entry.id });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/feedback", method: "POST" } });
    const m = err instanceof Error ? err.message : "unknown";
    return Response.json({ error: m }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!hasKv()) {
    return Response.json({ items: [] });
  }
  const expected = process.env.ADMIN_KEY;
  const provided = req.headers.get("x-admin-key");
  if (!expected || provided !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const ids = (await kv.lrange<string>(LIST_KEY, 0, limit - 1)) ?? [];
    const items = (await Promise.all(ids.map((id) => kv.get<FeedbackEntry>(ITEM_KEY(id))))).filter(
      (x): x is FeedbackEntry => Boolean(x),
    );
    return Response.json({ items });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/feedback", method: "GET" } });
    const m = err instanceof Error ? err.message : "unknown";
    return Response.json({ error: m }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!hasKv()) {
    return Response.json({ error: "feedback disabled" }, { status: 503 });
  }
  const expected = process.env.ADMIN_KEY;
  const provided = req.headers.get("x-admin-key");
  if (!expected || provided !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { id?: string; status?: FeedbackEntry["status"] };
    const id = typeof body.id === "string" ? body.id : "";
    const status = body.status;
    if (!id || !status || !["new", "read", "resolved", "dismissed"].includes(status)) {
      return Response.json({ error: "invalid input" }, { status: 400 });
    }
    const entry = await kv.get<FeedbackEntry>(ITEM_KEY(id));
    if (!entry) return Response.json({ error: "not found" }, { status: 404 });
    entry.status = status;
    await kv.set(ITEM_KEY(id), entry);
    return Response.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "/api/feedback", method: "PATCH" } });
    const m = err instanceof Error ? err.message : "unknown";
    return Response.json({ error: m }, { status: 500 });
  }
}
