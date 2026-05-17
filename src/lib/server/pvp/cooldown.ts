// PvP 도전 쿨다운 — 마지막 attacker 매치 기준 N초.
//
// /api/pvp/challenge 에서 차단(429) + /api/pvp/status 에서 nextChallengeAt 노출 양쪽이
// 같은 소스를 봐야 하므로 헬퍼로 분리. 데이터는 pvp_matches.created_at 만 사용 — 별도
// 컬럼/테이블 없이 attacker_idx (attackerId, createdAt) 가 그대로 cover.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pvpMatches } from "@/db/schema";

export const CHALLENGE_COOLDOWN_MS = 60_000;

/**
 * 현재 쿨다운이 진행 중이면 다음 도전 가능 시각, 아니면 null.
 * - 도전 이력이 없거나 60초 이상 지났으면 null
 */
export async function getNextChallengeAt(userId: string): Promise<Date | null> {
  const last = await db
    .select({ createdAt: pvpMatches.createdAt })
    .from(pvpMatches)
    .where(eq(pvpMatches.attackerId, userId))
    .orderBy(desc(pvpMatches.createdAt))
    .limit(1);
  const row = last[0];
  if (!row) return null;
  const nextAt = new Date(row.createdAt.getTime() + CHALLENGE_COOLDOWN_MS);
  if (nextAt.getTime() <= Date.now()) return null;
  return nextAt;
}
