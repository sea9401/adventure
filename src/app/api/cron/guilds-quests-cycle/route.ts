import { isNull } from "drizzle-orm";
import { db } from "@/db";
import { guildQuestInstances, guilds } from "@/db/schema";
import {
  GUILD_QUESTS,
  gradeForFame,
  poolGradesFor,
} from "@/adventure/data/guildQuests";

const PROPOSED_PER_WEEK = 3;

// 이번 주 시작(월요일 00:00 KST) 시각 — cron 이 호출되는 그 주.
// schedule "0 15 * * 0" → UTC 일요일 15:00 = KST 월요일 00:00.
function thisWeekStartKST(now = new Date()): Date {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const day = kstNow.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const kstMonday = new Date(kstNow);
  kstMonday.setUTCDate(kstNow.getUTCDate() - daysSinceMonday);
  kstMonday.setUTCHours(0, 0, 0, 0);
  return new Date(kstMonday.getTime() - KST_OFFSET_MS);
}

// GET /api/cron/guilds-quests-cycle — 매주 월요일 00:00 KST 자동 실행.
// 모든 활성 길드에 길드별 등급 풀(슬라이딩 윈도우 ±2)에서 3개 무작위 추첨해 proposed 발행.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const weekStart = thisWeekStartKST();
  const activeGuilds = await db
    .select({
      id: guilds.id,
      fameTotal: guilds.fameTotal,
    })
    .from(guilds)
    .where(isNull(guilds.disbandedAt));

  let totalIssued = 0;
  for (const g of activeGuilds) {
    const grade = gradeForFame(g.fameTotal);
    const allowedGrades = new Set(poolGradesFor(grade));
    const pool = GUILD_QUESTS.filter((q) => allowedGrades.has(q.grade));
    if (pool.length === 0) continue;

    // 무작위 추첨 (중복 없음). 풀이 3개 미만이면 가능한 만큼.
    const picks: typeof pool = [];
    const candidates = [...pool];
    const n = Math.min(PROPOSED_PER_WEEK, candidates.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      picks.push(candidates[idx]);
      candidates.splice(idx, 1);
    }

    for (const def of picks) {
      await db.insert(guildQuestInstances).values({
        guildId: g.id,
        weekStart,
        questDefId: def.id,
        grade: def.grade,
        status: "proposed",
        target: def.task.count,
      });
      totalIssued++;
    }
  }

  return Response.json({
    ok: true,
    weekStart: weekStart.toISOString(),
    guildsProcessed: activeGuilds.length,
    instancesIssued: totalIssued,
  });
}
