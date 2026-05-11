import { isNull } from "drizzle-orm";
import { db } from "@/db";
import { guildQuestInstances, guilds } from "@/db/schema";
import {
  GUILD_QUESTS,
  gradeForFame,
  poolGradesFor,
} from "@/adventure/data/guildQuests";

export const PROPOSED_PER_WEEK = 3;

// 이번 주 시작(월요일 00:00 KST) 시각.
// 주간 cron schedule "0 15 * * 0" → UTC 일요일 15:00 = KST 월요일 00:00.
export function thisWeekStartKST(now = new Date()): Date {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const day = kstNow.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const kstMonday = new Date(kstNow);
  kstMonday.setUTCDate(kstNow.getUTCDate() - daysSinceMonday);
  kstMonday.setUTCHours(0, 0, 0, 0);
  return new Date(kstMonday.getTime() - KST_OFFSET_MS);
}

// 모든 활성 길드에 길드별 등급 풀(슬라이딩 윈도우 ±2)에서 PROPOSED_PER_WEEK 개를
// 무작위 추첨해 proposed 인스턴스를 발행한다. 주간 cron 과 어드민 재발행이 공유.
// 중복 발행 방지는 호출 측 책임 — 어드민은 먼저 해당 주 인스턴스를 지운 뒤 호출한다.
export async function issueWeeklyProposals(
  weekStart: Date,
): Promise<{ guildsProcessed: number; instancesIssued: number }> {
  const activeGuilds = await db
    .select({ id: guilds.id, fameTotal: guilds.fameTotal })
    .from(guilds)
    .where(isNull(guilds.disbandedAt));

  let totalIssued = 0;
  for (const g of activeGuilds) {
    const grade = gradeForFame(g.fameTotal);
    const allowedGrades = new Set(poolGradesFor(grade));
    const pool = GUILD_QUESTS.filter((q) => allowedGrades.has(q.grade));
    if (pool.length === 0) continue;

    // 무작위 추첨 (중복 없음). 풀이 PROPOSED_PER_WEEK 미만이면 가능한 만큼.
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
        status: "active",
        activatedAt: weekStart,
        target: def.task.count,
      });
      totalIssued++;
    }
  }

  return { guildsProcessed: activeGuilds.length, instancesIssued: totalIssued };
}
