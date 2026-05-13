// 협동 토벌 보스 — claim 액션 처리.
//
// 가장 최근 처치된 세션에 대해 본인 기여 비율로 tier 를 산정, 보상을 계산하고
// claimedAt/claimedTier 를 마킹한다. (보상 실지급은 클라가 응답을 받아 처리)

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { coopBossContributors, coopBossSessions } from "@/db/schema";
import { COOP_BOSSES, coopTierForRatio } from "@/adventure/coop/data";
import { computeCoopReward } from "@/adventure/coop/rewards";
import type { RegionId } from "@/adventure/data/world";

export async function handleCoopClaim(
  userId: string,
  region: string,
): Promise<Response> {
  const def = COOP_BOSSES[region as RegionId];
  if (!def) return new Response("region has no coop boss", { status: 400 });

  // 가장 최근 처치된 세션 찾기.
  const recent = await db
    .select()
    .from(coopBossSessions)
    .where(eq(coopBossSessions.regionId, region))
    .orderBy(sql`${coopBossSessions.spawnedAt} DESC`)
    .limit(1);
  const session = recent[0];
  if (!session || !session.defeatedAt) {
    return new Response("no defeated boss", { status: 404 });
  }

  // 본인 기여 확인.
  const my = await db
    .select()
    .from(coopBossContributors)
    .where(
      and(
        eq(coopBossContributors.sessionId, session.id),
        eq(coopBossContributors.userId, userId),
      ),
    )
    .limit(1);
  const myRow = my[0];
  if (!myRow) return new Response("no contribution", { status: 403 });
  if (myRow.claimedAt) return new Response("already claimed", { status: 409 });

  const ratio = myRow.damage / Math.max(1, session.maxHp);
  const tier = coopTierForRatio(ratio);
  if (!tier) return new Response("below bronze threshold", { status: 403 });

  // claim 마킹 — 조건부 UPDATE(CAS): claimedAt 이 아직 NULL 일 때만 한 행이 점유한다.
  // (보상 실지급은 클라가 이 응답의 reward 를 받아 처리하므로, 동시에 들어온 두 건이
  //  둘 다 200 + reward 를 받으면 재료가 중복 지급된다. RETURNING 으로 실제 갱신된 행을
  //  받은 1건만 reward 를 돌려주고 나머지는 409.)
  const [claimed] = await db
    .update(coopBossContributors)
    .set({ claimedAt: new Date(), claimedTier: tier })
    .where(
      and(
        eq(coopBossContributors.sessionId, session.id),
        eq(coopBossContributors.userId, userId),
        isNull(coopBossContributors.claimedAt),
      ),
    )
    .returning({ id: coopBossContributors.userId });
  if (!claimed) return new Response("already claimed", { status: 409 });

  const reward = computeCoopReward(session.bossName, tier);
  return Response.json({ tier, ratio, reward });
}
