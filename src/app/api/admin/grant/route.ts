import { kv } from "@vercel/kv";

export const runtime = "nodejs";

const KEY_PREFIX = "grants:";
const MAX_PER_NICK = 50;
const TTL_SEC = 30 * 24 * 60 * 60; // 30일

type Grant = {
  id: string;
  exp: number;
  grantedAt: number;
  note?: string;
};

const hasKv = () => !!process.env.KV_REST_API_URL;

const keyFor = (nickname: string) => `${KEY_PREFIX}${nickname.trim().toLowerCase()}`;

const newGrantId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type GrantBody = {
  action: "grant";
  adminKey: string;
  targetNickname: string;
  exp: number;
  note?: string;
};

type ConsumeBody = {
  action: "consume";
  nickname: string;
};

type Body = GrantBody | ConsumeBody;

export async function POST(req: Request) {
  if (!hasKv()) {
    return Response.json({ error: "kv disabled" }, { status: 503 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  if (body.action === "grant") {
    const expected = process.env.ADMIN_KEY;
    if (!expected || body.adminKey !== expected) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const target = (body.targetNickname ?? "").trim().slice(0, 20);
    const exp = Math.max(0, Math.floor(body.exp ?? 0));
    if (!target) return Response.json({ error: "닉네임 필요" }, { status: 400 });
    if (exp <= 0) return Response.json({ error: "EXP > 0 필요" }, { status: 400 });

    const key = keyFor(target);
    const list = (await kv.get<Grant[]>(key)) ?? [];
    if (list.length >= MAX_PER_NICK) {
      return Response.json(
        { error: `대상의 보류 grant가 한도(${MAX_PER_NICK})에 도달했습니다` },
        { status: 409 },
      );
    }
    const grant: Grant = {
      id: newGrantId(),
      exp,
      grantedAt: Date.now(),
      note: body.note?.slice(0, 80),
    };
    list.push(grant);
    await kv.set(key, list, { ex: TTL_SEC });
    return Response.json({ ok: true, grantId: grant.id, pending: list.length });
  }

  if (body.action === "consume") {
    const nickname = (body.nickname ?? "").trim().slice(0, 20);
    if (!nickname) return Response.json({ error: "닉네임 필요" }, { status: 400 });
    const key = keyFor(nickname);
    const list = (await kv.get<Grant[]>(key)) ?? [];
    if (list.length === 0) return Response.json({ grants: [] });
    await kv.del(key);
    return Response.json({ grants: list });
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}

export async function GET(req: Request) {
  if (!hasKv()) {
    return Response.json({ grants: [], disabled: true });
  }
  const url = new URL(req.url);
  const nickname = (url.searchParams.get("nickname") ?? "").trim().slice(0, 20);
  if (!nickname) return Response.json({ error: "닉네임 필요" }, { status: 400 });
  const list = (await kv.get<Grant[]>(keyFor(nickname))) ?? [];
  return Response.json({ grants: list });
}
