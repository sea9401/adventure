import { sql } from "drizzle-orm";
import { db } from "@/db";
import { savesKv } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { upsertSave } from "@/lib/server/savesKv";
import { PROFILE_STORAGE_KEY } from "@/lib/storage-keys";
import { isValidAvatarId } from "@/adventure/profile/avatars";

// POST /api/profile/avatar
// 본문: { gender: Avatar }
// 이미 캐릭터를 만든 유저의 프로필 이미지(외형)만 변경. 이름·기타 필드는 보존.
//
// 응답:
//   200 { ok: true } — 성공
//   400 { error: "invalid" } — gender 가 알 수 없는 id
//   404 { error: "no_profile" } — 아직 캐릭터 생성 전 (/api/profile/setup 사용)
export async function POST(req: Request) {
  let userId: string | null;
  try {
    userId = await ensureUser();
  } catch (e) {
    const err = e as { code?: string; name?: string; message?: string };
    console.error("[/api/profile/avatar] ensureUser threw", {
      code: err.code,
      name: err.name,
      message: err.message,
    });
    return new Response("server error (auth)", { status: 500 });
  }
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: { gender?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const gender = typeof body.gender === "string" ? body.gender : "";
  if (!isValidAvatarId(gender)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  try {
    // 기존 프로필 읽기 — 이름이 없으면 setup 안 한 유저로 간주.
    const rows = await db
      .select({ value: savesKv.value })
      .from(savesKv)
      .where(
        sql`${savesKv.userId} = ${userId} and ${savesKv.key} = ${PROFILE_STORAGE_KEY}`,
      )
      .limit(1);
    const existing = (rows[0]?.value as { name?: unknown } | undefined) ?? null;
    const name = typeof existing?.name === "string" ? existing.name : null;
    if (!name) {
      return Response.json({ error: "no_profile" }, { status: 404 });
    }

    const profile = { name, gender };
    await upsertSave(db, userId, PROFILE_STORAGE_KEY, profile);

    return Response.json({ ok: true, profile });
  } catch (e) {
    const err = e as { code?: string; message?: string; name?: string };
    console.error("[/api/profile/avatar] db failure", {
      userId,
      code: err.code,
      name: err.name,
      message: err.message,
    });
    return new Response("server error", { status: 500 });
  }
}
