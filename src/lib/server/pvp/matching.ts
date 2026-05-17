// PvP 상대 매칭 — 활성 유저 풀에서 Elo 범위 후보 1명 무작위 선출.
//
// 풀 = users × character.v2 (level ≥ MIN_LEVEL) × LEFT JOIN pvp_ratings(seasonId).
// rating row 없는 유저는 ELO_INITIAL 로 간주 → 신규도 매칭 가능.
//
// 범위 확장: ±200 → ±500 → ±1000 → 전체. 각 단계에서 후보 있으면 그 안에서 무작위 1명.
// 전 단계에서 빈 풀이면 null 반환 (호출 측에서 503 처리). 봇 fallback 은 MVP 미포함.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ELO_INITIAL } from "./elo";

export type OpponentCandidate = {
  userId: string;
  name: string;
  rating: number;
};

// 너무 신규 계정과 매칭되면 일방적이라 최소 레벨 컷.
const MIN_LEVEL = 5;
// 범위는 좁은 곳부터 시도 — 비슷한 실력 우선.
const RATING_RANGES: readonly number[] = [200, 500, 1000];

export async function fetchCandidatePool(
  selfId: string,
  seasonId: string,
): Promise<OpponentCandidate[]> {
  const result = await db.execute(sql`
    SELECT
      u.id AS user_id,
      COALESCE(u.game_name, p.value->>'name') AS name,
      COALESCE(r.rating, ${ELO_INITIAL}) AS rating
    FROM users u
    INNER JOIN saves_kv c
      ON c.user_id = u.id AND c.key = 'character.v2'
    LEFT JOIN saves_kv p
      ON p.user_id = u.id AND p.key = 'character-profile.v2'
    LEFT JOIN pvp_ratings r
      ON r.user_id = u.id AND r.season_id = ${seasonId}
    WHERE u.id <> ${selfId}
      AND COALESCE(u.game_name, p.value->>'name') IS NOT NULL
      AND COALESCE((c.value->>'level')::int, 1) >= ${MIN_LEVEL}
  `);
  type DbRow = { user_id: string; name: string; rating: number };
  return (result.rows as unknown as DbRow[]).map((r) => ({
    userId: String(r.user_id),
    name: String(r.name),
    rating: Number(r.rating),
  }));
}

// 풀에서 myRating 기준 가장 좁은 범위부터 후보가 있는 단계 선택, 그 안에서 무작위 1명.
// 전체에서도 빈 풀이면 null.
export function pickFromPool(
  pool: readonly OpponentCandidate[],
  myRating: number,
): OpponentCandidate | null {
  for (const range of RATING_RANGES) {
    const inRange = pool.filter(
      (c) => Math.abs(c.rating - myRating) <= range,
    );
    if (inRange.length > 0) {
      return inRange[Math.floor(Math.random() * inRange.length)];
    }
  }
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

export async function pickOpponent(args: {
  selfId: string;
  myRating: number;
  seasonId: string;
}): Promise<OpponentCandidate | null> {
  const pool = await fetchCandidatePool(args.selfId, args.seasonId);
  return pickFromPool(pool, args.myRating);
}
