// GET /api/pvp/stats — 본인 이번 시즌 매치 집계.
//
// 응답:
//   - timeline:           매치 시간순 [{ id, createdAt, ratingAfter }] (sparkline 용)
//   - peak:               시즌내 최고 ratingAfter + 도달 시각 (null = 매치 없음)
//   - currentStreak:      현재 흐름 — { kind: "win"|"loss"|"draw"|"none", count }
//   - frequentOpponents:  매치 수 top 3 — { userId, name, isBot, matches, wins, losses, draws }
//
// 통계 탭이 lazy fetch — 평소 호출 없음. 시즌 단위라 매치 수가 bounded (수십~수백)이므로
// 집계는 Node 에서. SQL aggregate 없이 단순 fetch + reduce.

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { pvpMatches, savesKv, users } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { getOrCreateCurrentSeason } from "@/lib/server/pvp/season";
import { isBotId } from "@/lib/server/pvp/bots";

type MyOutcome = "win" | "loss" | "draw";
type StreakKind = MyOutcome | "none";

export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const season = await getOrCreateCurrentSeason();

  // 시즌 내 본인 매치 — attacker / defender 양쪽. 양쪽 인덱스 OR → PG bitmap scan.
  const matches = await db
    .select()
    .from(pvpMatches)
    .where(
      and(
        eq(pvpMatches.seasonId, season.id),
        or(
          eq(pvpMatches.attackerId, userId),
          eq(pvpMatches.defenderId, userId),
        ),
      ),
    )
    .orderBy(asc(pvpMatches.createdAt));

  // 본인 시점으로 정규화 — opponentId / myOutcome / ratingAfter 만 뽑아 재사용.
  const perMatch = matches.map((m) => {
    const iAmAttacker = m.attackerId === userId;
    const opponentId = iAmAttacker ? m.defenderId : m.attackerId;
    const ratingAfter = iAmAttacker
      ? m.attackerRatingAfter
      : m.defenderRatingAfter;
    let myOutcome: MyOutcome;
    if (m.outcome === "draw") myOutcome = "draw";
    else if (m.outcome === "a_win") myOutcome = iAmAttacker ? "win" : "loss";
    else myOutcome = iAmAttacker ? "loss" : "win";
    return { id: m.id, createdAt: m.createdAt, ratingAfter, opponentId, myOutcome };
  });

  const timeline = perMatch.map((p) => ({
    id: p.id,
    createdAt: p.createdAt,
    ratingAfter: p.ratingAfter,
  }));

  // Peak — 최고 ratingAfter (동률은 최초 도달 시각).
  let peak: { rating: number; at: Date } | null = null;
  for (const p of perMatch) {
    if (!peak || p.ratingAfter > peak.rating) {
      peak = { rating: p.ratingAfter, at: p.createdAt };
    }
  }

  // 현재 스트릭 — 가장 최근 매치의 outcome 부터 역방향으로 같은 outcome 카운트.
  // draw 도 자체 스트릭으로 취급 (보통 0/희귀). 매치 없으면 "none".
  let currentStreak: { kind: StreakKind; count: number } = { kind: "none", count: 0 };
  if (perMatch.length > 0) {
    const lastOutcome = perMatch[perMatch.length - 1].myOutcome;
    let count = 1;
    for (let i = perMatch.length - 2; i >= 0; i--) {
      if (perMatch[i].myOutcome === lastOutcome) count++;
      else break;
    }
    currentStreak = { kind: lastOutcome, count };
  }

  // 자주 만난 상대 — opponentId 별 집계 → top 3 (매치 수 desc, 동률은 최근 마지막 매치 시각 desc).
  type AggRow = {
    matches: number;
    wins: number;
    losses: number;
    draws: number;
    lastAt: Date;
  };
  const oppMap = new Map<string, AggRow>();
  for (const p of perMatch) {
    const cur =
      oppMap.get(p.opponentId) ??
      ({ matches: 0, wins: 0, losses: 0, draws: 0, lastAt: p.createdAt } as AggRow);
    cur.matches += 1;
    if (p.myOutcome === "win") cur.wins += 1;
    else if (p.myOutcome === "loss") cur.losses += 1;
    else cur.draws += 1;
    cur.lastAt = p.createdAt; // perMatch 가 ASC 라 자연스럽게 최신 매치 시각.
    oppMap.set(p.opponentId, cur);
  }
  const topOppIds = [...oppMap.entries()]
    .sort((a, b) => {
      if (b[1].matches !== a[1].matches) return b[1].matches - a[1].matches;
      return b[1].lastAt.getTime() - a[1].lastAt.getTime();
    })
    .slice(0, 3);

  // 상대 닉네임 batch 조회 — /api/pvp/status 와 동일 패턴 (gameName → profile.v2.name 폴백).
  const nameMap = new Map<string, string>();
  if (topOppIds.length > 0) {
    const ids = topOppIds.map(([id]) => id);
    const [uRows, pRows] = await Promise.all([
      db
        .select({ id: users.id, gameName: users.gameName })
        .from(users)
        .where(inArray(users.id, ids)),
      db
        .select({ userId: savesKv.userId, value: savesKv.value })
        .from(savesKv)
        .where(
          sql`${savesKv.userId} IN (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )}) AND ${savesKv.key} = 'character-profile.v2'`,
        ),
    ]);
    const profileName = new Map<string, string>();
    for (const r of pRows) {
      const v = r.value as { name?: unknown } | null | undefined;
      if (v && typeof v.name === "string") profileName.set(r.userId, v.name);
    }
    for (const u of uRows) {
      const gn = u.gameName?.trim();
      if (gn) nameMap.set(u.id, gn);
      else if (profileName.has(u.id))
        nameMap.set(u.id, profileName.get(u.id) ?? "");
    }
  }

  const frequentOpponents = topOppIds.map(([id, agg]) => ({
    userId: id,
    name: nameMap.get(id) ?? "이름 없는 모험가",
    isBot: isBotId(id),
    matches: agg.matches,
    wins: agg.wins,
    losses: agg.losses,
    draws: agg.draws,
  }));

  return Response.json({
    seasonId: season.id,
    timeline,
    peak,
    currentStreak,
    frequentOpponents,
  });
}
