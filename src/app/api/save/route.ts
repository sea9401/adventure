import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { savesKv } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { isSyncedKey, type SyncedKey } from "@/lib/storage/synced-keys";

// GET /api/save — 로그인한 사용자의 모든 동기화 키-값을 한 번에 반환.
// 클라이언트는 마운트 시 1회 호출해 Context 에 hydrate.
export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const rows = await db
    .select({ key: savesKv.key, value: savesKv.value })
    .from(savesKv)
    .where(eq(savesKv.userId, userId));

  const out: Partial<Record<SyncedKey, unknown>> = {};
  for (const row of rows) {
    if (isSyncedKey(row.key)) {
      out[row.key] = row.value;
    }
  }
  return Response.json(out);
}

// PATCH /api/save?key=character.v1 — 단일 키 upsert.
// 본문: { value: <jsonb> }
export async function PATCH(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key || !isSyncedKey(key)) {
    return new Response(`unknown key: ${key}`, { status: 400 });
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

  await db
    .insert(savesKv)
    .values({ userId, key, value: body.value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [savesKv.userId, savesKv.key],
      set: { value: body.value, updatedAt: new Date() },
    });

  return Response.json({ ok: true, updatedAt: Date.now() });
}

// DELETE /api/save — 사용자의 모든 동기화 데이터 제거 (관리자 페이지에서 사용).
// DELETE /api/save?key=character.v1 — 단일 키만 제거.
export async function DELETE(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (key) {
    if (!isSyncedKey(key)) {
      return new Response(`unknown key: ${key}`, { status: 400 });
    }
    await db
      .delete(savesKv)
      .where(and(eq(savesKv.userId, userId), eq(savesKv.key, key)));
  } else {
    await db.delete(savesKv).where(eq(savesKv.userId, userId));
  }

  return Response.json({ ok: true });
}
