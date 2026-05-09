import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users, savesKv } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { upsertSave } from "@/lib/server/savesKv";
import { PROFILE_STORAGE_KEY } from "@/lib/storage-keys";
import { AVATARS } from "@/adventure/profile/avatars";

const NAME_MIN = 1;
const NAME_MAX = 16;

// POST /api/profile/setup
// 본문: { name: string, gender: Avatar }
// 1) 닉네임 검증·중복 체크 (case-insensitive)
// 2) users.name 등록 (UNIQUE 제약이 race condition 도 방어)
// 3) savesKv 프로필 upsert
//
// 응답:
// 200 { ok: true } — 성공
// 400 { error: "invalid" | "missing" } — 유효성 실패
// 409 { error: "taken" } — 중복 (낙관적 검증 또는 unique 제약 위반)
export async function POST(req: Request) {
  let userId: string | null;
  try {
    userId = await ensureUser();
  } catch (e) {
    const err = e as { code?: string; name?: string; message?: string };
    console.error("[/api/profile/setup] ensureUser threw", {
      code: err.code,
      name: err.name,
      message: err.message,
    });
    return new Response("server error (auth)", { status: 500 });
  }
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: { name?: unknown; gender?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const gender = typeof body.gender === "string" ? body.gender : "";
  if (!(AVATARS as readonly string[]).includes(gender)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }

  try {
    // 사전 중복 검사 (UX 용 — race 는 unique 제약이 잡음).
    // legacy 프로필도 함께 검사.
    const legacyHit = await db
      .select({ userId: savesKv.userId })
      .from(savesKv)
      .where(
        sql`${savesKv.key} = ${PROFILE_STORAGE_KEY} and ${savesKv.userId} <> ${userId} and lower(${savesKv.value}->>'name') = lower(${name})`,
      )
      .limit(1);
    if (legacyHit.length > 0) {
      return Response.json({ error: "taken" }, { status: 409 });
    }

    // users.name unique upsert. 다른 유저가 같은 이름 가지면 unique 제약 위반.
    try {
      await db
        .update(users)
        .set({ name, updatedAt: new Date() })
        .where(sql`${users.id} = ${userId}`);
    } catch (e) {
      // Postgres unique violation: code 23505
      const code = (e as { code?: string }).code;
      if (code === "23505") {
        return Response.json({ error: "taken" }, { status: 409 });
      }
      throw e;
    }

    const profile = { name, gender };
    await upsertSave(db, userId, PROFILE_STORAGE_KEY, profile);

    return Response.json({ ok: true, profile });
  } catch (e) {
    // 진단용 — 5xx 가 빈번한 경우 Vercel 로그에서 패턴 확인.
    // userId 는 추적용으로 남기되 name 은 잠재적 PII 가 적어도 한 번 더 확인 후 추가.
    const err = e as { code?: string; message?: string; name?: string };
    console.error("[/api/profile/setup] db failure", {
      userId,
      code: err.code,
      name: err.name,
      message: err.message,
    });
    return new Response("server error", { status: 500 });
  }
}
