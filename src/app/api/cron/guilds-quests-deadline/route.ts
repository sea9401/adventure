import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { guildQuestInstances } from "@/db/schema";

// GET /api/cron/guilds-quests-deadline — 매주 일요일 23:59 KST 자동 실행.
// schedule "59 14 * * 0" → UTC 일요일 14:59 = KST 일요일 23:59.
// active(progress < target) + proposed(미수락) 모두 expired 처리.
// 그 직후 1분 뒤 cycle cron 이 새 주 후보 발행.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  // active 미완료.
  const expiredActive = await db
    .update(guildQuestInstances)
    .set({ status: "expired" })
    .where(
      sql`${guildQuestInstances.status} = 'active' AND ${guildQuestInstances.progress} < ${guildQuestInstances.target}`,
    )
    .returning({ id: guildQuestInstances.id });

  // proposed 미수락.
  const expiredProposed = await db
    .update(guildQuestInstances)
    .set({ status: "expired" })
    .where(eq(guildQuestInstances.status, "proposed"))
    .returning({ id: guildQuestInstances.id });

  return Response.json({
    ok: true,
    expiredActive: expiredActive.length,
    expiredProposed: expiredProposed.length,
  });
}
