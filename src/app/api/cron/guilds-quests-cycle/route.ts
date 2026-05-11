import { issueWeeklyProposals, thisWeekStartKST } from "@/lib/server/guildQuests";

// GET /api/cron/guilds-quests-cycle — 매주 월요일 00:00 KST 자동 실행.
// 모든 활성 길드에 길드별 등급 풀(슬라이딩 윈도우 ±2)에서 3개 무작위 추첨해 proposed 발행.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const weekStart = thisWeekStartKST();
  const { guildsProcessed, instancesIssued } = await issueWeeklyProposals(weekStart);

  return Response.json({
    ok: true,
    weekStart: weekStart.toISOString(),
    guildsProcessed,
    instancesIssued,
  });
}
