import { eq } from "drizzle-orm";
import { db } from "@/db";
import { savesKv, users } from "@/db/schema";
import { requireAdmin } from "@/lib/server/isAdmin";
import { upsertSave } from "@/lib/server/savesKv";
import { isSyncedKey, type SyncedKey } from "@/lib/storage/synced-keys";

async function userExists(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows.length > 0;
}

// GET /api/admin/saves?userId=<id>
// 대상 유저의 모든 동기화 키-값을 한 번에 반환. userId 없으면 400.
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate) return gate;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return new Response("missing userId", { status: 400 });
  if (!(await userExists(userId))) {
    return new Response("user not found", { status: 404 });
  }

  const rows = await db
    .select({ key: savesKv.key, value: savesKv.value })
    .from(savesKv)
    .where(eq(savesKv.userId, userId));

  const out: Partial<Record<SyncedKey, unknown>> = {};
  for (const row of rows) {
    if (isSyncedKey(row.key)) out[row.key] = row.value;
  }
  return Response.json(out);
}

// PATCH /api/admin/saves?userId=<id>&key=<synced-key>
// 본문: { value: <jsonb> } — 단일 키 upsert.
// 주의: 대상 유저의 게임 라우트는 새로고침해야 반영된다.
export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (gate) return gate;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const key = url.searchParams.get("key");
  if (!userId) return new Response("missing userId", { status: 400 });
  if (!key || !isSyncedKey(key)) {
    return new Response(`unknown key: ${key}`, { status: 400 });
  }
  if (!(await userExists(userId))) {
    return new Response("user not found", { status: 404 });
  }

  let body: { value: unknown };
  try {
    body = (await req.json()) as { value: unknown };
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (body.value === undefined) {
    return new Response("missing value", { status: 400 });
  }

  await upsertSave(db, userId, key, body.value);

  return Response.json({ ok: true, updatedAt: Date.now() });
}
