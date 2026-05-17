// PvP 시즌별 레이팅 row 의 CRUD.
//
// 매칭/도전 API (PR-3) 가 매 호출마다:
//   1) getCurrentSeason() 으로 시즌 고정
//   2) getOrCreateRating(myId, seasonId) — 본인 row (없으면 1000 초기화)
//   3) 매칭 후보 1명 선출 — 그 후보의 row 도 getOrCreateRating
//   4) PvP 시뮬 → applyEloMatch → 양쪽 rating 업데이트 + pvpMatches INSERT
//
// dailyEarned / dailyResetAt 은 보상 화폐 (별도 PR) 의 일일 캡 추적용 — 이 PR 에선
// 컬럼만 채워둠.

import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { pvpMatches, pvpRatings } from "@/db/schema";
import { ELO_INITIAL, applyEloMatch } from "./elo";

export type PvPRatingRow = typeof pvpRatings.$inferSelect;
export type PvPMatchRow = typeof pvpMatches.$inferSelect;

// 시즌별 유저 레이팅 row. 없으면 ELO_INITIAL=1000 으로 INSERT. PK race 안전.
export async function getOrCreateRating(
  userId: string,
  seasonId: string,
): Promise<PvPRatingRow> {
  const existing = await db
    .select()
    .from(pvpRatings)
    .where(
      and(eq(pvpRatings.userId, userId), eq(pvpRatings.seasonId, seasonId)),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(pvpRatings)
    .values({ userId, seasonId, rating: ELO_INITIAL })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];

  // race — 다른 요청이 먼저 insert.
  const refetch = await db
    .select()
    .from(pvpRatings)
    .where(
      and(eq(pvpRatings.userId, userId), eq(pvpRatings.seasonId, seasonId)),
    )
    .limit(1);
  if (!refetch[0]) {
    throw new Error(`pvp rating ${userId}/${seasonId} missing after race`);
  }
  return refetch[0];
}

// 매치 1건 처리 — 양쪽 rating 갱신 + matches row 1건 INSERT. tx 1개로 묶음.
// 호출 측은 이미 PvP 엔진을 돌려 outcome 결정한 상태로 진입.
export async function recordMatchAndUpdateRatings(args: {
  seasonId: string;
  attackerId: string;
  defenderId: string;
  outcome: "a_win" | "d_win" | "draw";
  log: unknown; // PvPBattleState["log"] — jsonb 로 저장
}): Promise<{ attackerAfter: number; defenderAfter: number }> {
  return db.transaction(async (tx) => {
    // 양쪽 row select for update (잠금 + race 가드).
    const aRows = await tx
      .select()
      .from(pvpRatings)
      .where(
        and(
          eq(pvpRatings.userId, args.attackerId),
          eq(pvpRatings.seasonId, args.seasonId),
        ),
      )
      .for("update");
    const dRows = await tx
      .select()
      .from(pvpRatings)
      .where(
        and(
          eq(pvpRatings.userId, args.defenderId),
          eq(pvpRatings.seasonId, args.seasonId),
        ),
      )
      .for("update");

    const a = aRows[0];
    const d = dRows[0];
    if (!a || !d) {
      throw new Error("pvp ratings missing — getOrCreateRating 호출 누락");
    }

    const { attackerAfter, defenderAfter } = applyEloMatch(
      a.rating,
      d.rating,
      args.outcome,
    );

    const now = new Date();
    await tx
      .update(pvpRatings)
      .set({
        rating: attackerAfter,
        wins: args.outcome === "a_win" ? a.wins + 1 : a.wins,
        losses: args.outcome === "d_win" ? a.losses + 1 : a.losses,
        draws: args.outcome === "draw" ? a.draws + 1 : a.draws,
        updatedAt: now,
      })
      .where(
        and(
          eq(pvpRatings.userId, args.attackerId),
          eq(pvpRatings.seasonId, args.seasonId),
        ),
      );

    await tx
      .update(pvpRatings)
      .set({
        rating: defenderAfter,
        wins: args.outcome === "d_win" ? d.wins + 1 : d.wins,
        losses: args.outcome === "a_win" ? d.losses + 1 : d.losses,
        draws: args.outcome === "draw" ? d.draws + 1 : d.draws,
        updatedAt: now,
      })
      .where(
        and(
          eq(pvpRatings.userId, args.defenderId),
          eq(pvpRatings.seasonId, args.seasonId),
        ),
      );

    await tx.insert(pvpMatches).values({
      seasonId: args.seasonId,
      attackerId: args.attackerId,
      defenderId: args.defenderId,
      outcome: args.outcome,
      attackerRatingBefore: a.rating,
      defenderRatingBefore: d.rating,
      attackerRatingAfter: attackerAfter,
      defenderRatingAfter: defenderAfter,
      log: args.log as object,
    });

    return { attackerAfter, defenderAfter };
  });
}

// 시즌 순위표. partial=true 면 본인 위/아래 N명만, 아니면 절대 top.
export async function getSeasonLeaderboard(
  seasonId: string,
  limit: number = 50,
): Promise<PvPRatingRow[]> {
  return db
    .select()
    .from(pvpRatings)
    .where(eq(pvpRatings.seasonId, seasonId))
    .orderBy(desc(pvpRatings.rating))
    .limit(limit);
}

// 본인 최근 매치 N건 — attacker 든 defender 든 포함. 매치 카드 UI 표시용.
// (attacker / defender 양쪽 인덱스 있어 PG 가 OR → bitmap scan 으로 처리.)
export async function getMyRecentMatches(
  userId: string,
  limit: number = 20,
): Promise<PvPMatchRow[]> {
  return db
    .select()
    .from(pvpMatches)
    .where(
      or(eq(pvpMatches.attackerId, userId), eq(pvpMatches.defenderId, userId)),
    )
    .orderBy(desc(pvpMatches.createdAt))
    .limit(limit);
}
