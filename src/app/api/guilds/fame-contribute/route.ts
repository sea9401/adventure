import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { guildMembers, guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

// 한 호출당 최대 적립량 — 어뷰즈 차단 (퀘스트 보상도 일반적으로 한 자리수~수십).
const FAME_CONTRIBUTE_CAP_PER_CALL = 100;

// POST /api/guilds/fame-contribute — 멤버가 캐릭터 명성을 벌 때 같은 양을 길드 명성에 가산.
// body: { delta: number }
// 본인이 길드 멤버 아니면 silent ignore (성공 응답 + applied=false).
// fameTotal/fameAvailable 양쪽에 +delta.
export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: { delta?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const reqDelta = Math.floor(Number(body.delta));
  if (!Number.isFinite(reqDelta) || reqDelta <= 0) {
    return new Response("invalid delta", { status: 400 });
  }
  const delta = Math.min(reqDelta, FAME_CONTRIBUTE_CAP_PER_CALL);

  try {
    const result = await db.transaction(async (tx) => {
      const myRows = await tx
        .select({ guildId: guildMembers.guildId })
        .from(guildMembers)
        .where(eq(guildMembers.userId, userId))
        .limit(1);
      if (myRows.length === 0) {
        return { ok: true as const, applied: false };
      }
      const guildId = myRows[0].guildId;

      const upd = await tx
        .update(guilds)
        .set({
          fameTotal: sql`${guilds.fameTotal} + ${delta}`,
          fameAvailable: sql`${guilds.fameAvailable} + ${delta}`,
        })
        .where(and(eq(guilds.id, guildId), isNull(guilds.disbandedAt)))
        .returning({ fameTotal: guilds.fameTotal });
      if (upd.length === 0) {
        return { ok: true as const, applied: false };
      }

      return {
        ok: true as const,
        applied: true,
        fameAdded: delta,
        guildFameTotal: upd[0].fameTotal,
      };
    });

    return Response.json(result);
  } catch (e) {
    console.error("[guilds.fame-contribute.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
