import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { guildMembers, guildQuestInstances, guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { gradeForFame } from "@/adventure/data/guildQuests";

// 이번 주 시작(월요일 00:00 KST) — 서버 기준 KST 의 주 시작 시각.
function currentWeekStartKST(now = new Date()): Date {
  // KST = UTC+9. JS Date 는 UTC 기준이라 KST 로 변환 후 월요일로 정렬, 다시 UTC 로 환원.
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const day = kstNow.getUTCDay(); // 0=일, 1=월, …
  const daysSinceMonday = (day + 6) % 7;
  const kstMonday = new Date(kstNow);
  kstMonday.setUTCDate(kstNow.getUTCDate() - daysSinceMonday);
  kstMonday.setUTCHours(0, 0, 0, 0);
  return new Date(kstMonday.getTime() - KST_OFFSET_MS);
}

// GET /api/guilds/quests/this-week — 내 길드의 이번 주 의뢰 + 길드 명성 정보.
export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const myMembership = await db
    .select({ guildId: guildMembers.guildId })
    .from(guildMembers)
    .where(eq(guildMembers.userId, userId))
    .limit(1);
  if (myMembership.length === 0) {
    return Response.json({ guild: null, weekStart: null, active: null, proposed: [] });
  }
  const { guildId } = myMembership[0];

  const guildRows = await db
    .select()
    .from(guilds)
    .where(and(eq(guilds.id, guildId), isNull(guilds.disbandedAt)))
    .limit(1);
  if (guildRows.length === 0) {
    return Response.json({ guild: null, weekStart: null, active: null, proposed: [] });
  }
  const guild = guildRows[0];

  const weekStart = currentWeekStartKST();
  const instances = await db
    .select()
    .from(guildQuestInstances)
    .where(
      and(
        eq(guildQuestInstances.guildId, guildId),
        gte(guildQuestInstances.weekStart, weekStart),
      ),
    );

  const active = instances.find((r) => r.status === "active") ?? null;
  const proposed = instances.filter((r) => r.status === "proposed");

  const shape = (r: typeof instances[number]) => ({
    id: r.id,
    questDefId: r.questDefId,
    grade: r.grade,
    status: r.status,
    progress: r.progress,
    target: r.target,
    activatedAt: r.activatedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
  });

  return Response.json({
    guild: {
      id: guild.id,
      name: guild.name,
      masterId: guild.masterId,
      fameTotal: guild.fameTotal,
      fameAvailable: guild.fameAvailable,
      grade: gradeForFame(guild.fameTotal),
      isMaster: guild.masterId === userId,
    },
    weekStart: weekStart.toISOString(),
    active: active ? shape(active) : null,
    proposed: proposed.map(shape),
  });
}
