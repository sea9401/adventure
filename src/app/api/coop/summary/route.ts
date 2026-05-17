import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coopBossContributors,
  coopBossSessions,
} from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { COOP_ATTACK_COOLDOWN_MS, COOP_BOSSES } from "@/adventure/coop/data";
import type { RegionId } from "@/adventure/data/world";

// GET /api/coop/summary
// QuickTravel 화면 등 보스 카드 N개를 동시에 보여주는 자리에 쓰는 경량 요약.
// 각 coop region 의 최신 세션 status + 내 공격 쿨다운 잔여 ms.
//
// 무거운 GET /api/coop/[region] (6~9 query) 을 region 마다 호출하면 N+1 폭발.
// 이 엔드포인트는 batched 2 query — sessions + my contributions in active sessions.
// regen / respawn self-heal 은 안 함 (read-only) — 카드 상세 페이지 들어가는 순간
// 그쪽 GET 이 정리 책임. 화면 뱃지가 1분 stale 인 정도는 허용.

export type CoopSummaryRegion = {
  regionId: string;
  status: "no_session" | "active" | "defeated" | "expired";
  /** active 일 때만 — 내 다음 공격까지 ms. 0 이면 즉시 가능. */
  cooldownRemainingMs?: number;
  /** defeated 일 때만 — 재등장까지 ms (nextSpawnAt 가 있으면). */
  respawnRemainingMs?: number;
};

export type CoopSummaryResponse = { regions: CoopSummaryRegion[] };

export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const regionIds = Object.keys(COOP_BOSSES) as RegionId[];
  if (regionIds.length === 0) return Response.json({ regions: [] });

  // 1) 각 region 의 세션 (active 우선, 없으면 가장 최근). DB 에선 모든 세션을
  //    spawnedAt 내림차순으로 가져온 뒤 JS 측에서 region 별로 한 줄만 선별.
  const allSessions = await db
    .select()
    .from(coopBossSessions)
    .where(inArray(coopBossSessions.regionId, regionIds))
    .orderBy(sql`${coopBossSessions.spawnedAt} DESC`);

  type SessionRow = (typeof allSessions)[number];
  const sessionByRegion = new Map<string, SessionRow>();
  for (const s of allSessions) {
    const existing = sessionByRegion.get(s.regionId);
    if (!existing) {
      sessionByRegion.set(s.regionId, s);
      continue;
    }
    // 이미 들어있는 게 inactive(defeatedAt 셋) 이고 새로 본 게 active → 교체.
    // 둘 다 같은 상태면 spawnedAt 큰 게 먼저 들어와 있어 유지.
    if (existing.defeatedAt && !s.defeatedAt) {
      sessionByRegion.set(s.regionId, s);
    }
  }

  // 2) 활성 세션들의 내 기여 — 쿨다운 계산용.
  const activeSessionIds = Array.from(sessionByRegion.values())
    .filter((s) => !s.defeatedAt)
    .map((s) => s.id);

  const myContribs =
    activeSessionIds.length > 0
      ? await db
          .select()
          .from(coopBossContributors)
          .where(
            and(
              eq(coopBossContributors.userId, userId),
              inArray(coopBossContributors.sessionId, activeSessionIds),
            ),
          )
      : [];

  const myBySessionId = new Map(myContribs.map((c) => [c.sessionId, c]));

  // 3) 응답 빌드.
  const now = Date.now();
  const regions: CoopSummaryRegion[] = regionIds.map((regionId) => {
    const s = sessionByRegion.get(regionId);
    if (!s) return { regionId, status: "no_session" };

    if (s.defeatedAt) {
      const respawnAt = s.nextSpawnAt
        ? new Date(s.nextSpawnAt).getTime()
        : null;
      const respawnRemainingMs =
        respawnAt != null ? Math.max(0, respawnAt - now) : undefined;
      return { regionId, status: "defeated", respawnRemainingMs };
    }

    // 활성 세션이지만 TTL 지났을 수 있음 — cron self-heal 전이라 expired 로 표시.
    const expiresAtMs = new Date(s.expiresAt).getTime();
    if (now > expiresAtMs) {
      return { regionId, status: "expired" };
    }

    const my = myBySessionId.get(s.id);
    // cooldownEndsAt 은 DB 컬럼이 아니라 lastAttackAt + COOP_ATTACK_COOLDOWN_MS 로 파생.
    const cooldownEndsAtMs = my?.lastAttackAt
      ? new Date(my.lastAttackAt).getTime() + COOP_ATTACK_COOLDOWN_MS
      : 0;
    const cooldownRemainingMs = Math.max(0, cooldownEndsAtMs - now);
    return { regionId, status: "active", cooldownRemainingMs };
  });

  return Response.json({ regions });
}
