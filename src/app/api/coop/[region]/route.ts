import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coopBossAttackLog,
  coopBossContributors,
  coopBossSessions,
  savesKv,
  users,
} from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import {
  COOP_ATTACK_COOLDOWN_MS,
  COOP_BOSSES,
  coopTierForRatio,
  type CoopRewardTier,
} from "@/adventure/coop/data";
import { respawnCoopRegion } from "@/lib/server/coopRespawn";
import {
  handleCoopAttack,
  type CoopAttackBody,
} from "@/lib/server/coop/attack";
import { handleCoopClaim } from "@/lib/server/coop/claim";
import { applyLazyRegen } from "@/lib/server/coop/regen";
import type { RegionId } from "@/adventure/data/world";

const VALID_REGIONS = Object.keys(COOP_BOSSES) as RegionId[];

type Ctx = { params: Promise<{ region: string }> };

type ClaimBody = { action: "claim" };
type Body = CoopAttackBody | ClaimBody;

// GET /api/coop/[region] — 활성 세션 + 본인 기여 + top contributors.
export async function GET(_req: Request, { params }: Ctx) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const { region } = await params;
  if (!VALID_REGIONS.includes(region as RegionId)) {
    return new Response("invalid region", { status: 400 });
  }

  // self-healing — cron 미동작(dev) / 강등 환경에서 카드 여는 순간 만료 정리 +
  // 도달한 nextSpawnAt 에 신규 spawn. partial uniqueIndex 가 동시성 막아줌.
  // GET 은 클라가 N초마다 폴링하는 hot path 라 매 호출마다 돌리면 write 부담이
  // 큼 → 5% 확률로만 트리거. 5초 폴이면 평균 100초당 한 번 self-heal 됨.
  if (Math.random() < 0.05) await respawnCoopRegion(region);

  // 활성 세션 (defeatedAt IS NULL) 우선, 없으면 가장 최근 정리된 세션 (nextSpawnAt 정보 표시용).
  let active = await db
    .select()
    .from(coopBossSessions)
    .where(
      and(
        eq(coopBossSessions.regionId, region),
        isNull(coopBossSessions.defeatedAt),
      ),
    )
    .limit(1);

  // 월드 보스 lazy regen — regen_per_min > 0 인 활성 세션이면 진입 시점에 분 단위로
  // hp 회복 적용. 조건 미달이면 no-op. 적용 후 최신 hp 를 다시 읽음.
  if (active[0]) {
    await applyLazyRegen(active[0].id);
    active = await db
      .select()
      .from(coopBossSessions)
      .where(eq(coopBossSessions.id, active[0].id))
      .limit(1);
  }

  let session = active[0];
  const isActive = !!session;

  if (!session) {
    // 가장 최근 정리된 세션 — nextSpawnAt 표시.
    const recent = await db
      .select()
      .from(coopBossSessions)
      .where(eq(coopBossSessions.regionId, region))
      .orderBy(sql`${coopBossSessions.spawnedAt} DESC`)
      .limit(1);
    session = recent[0];
  }

  if (!session) {
    return Response.json({ session: null, myContribution: null, top: [] });
  }

  // 본인 기여.
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
  const myRow = my[0] ?? null;

  const myDamage = myRow?.damage ?? 0;
  const ratio = myDamage / Math.max(1, session.maxHp);
  const myTier = coopTierForRatio(ratio);

  // top 5 contributors (이름 join).
  const topRows = await db
    .select({
      damage: coopBossContributors.damage,
      attackCount: coopBossContributors.attackCount,
      userId: coopBossContributors.userId,
      name: users.gameName,
    })
    .from(coopBossContributors)
    .leftJoin(users, eq(users.id, coopBossContributors.userId))
    .where(eq(coopBossContributors.sessionId, session.id))
    .orderBy(sql`${coopBossContributors.damage} DESC`)
    .limit(5);

  // users.gameName 이 NULL 인 레거시 유저 — character-profile.v2.name 으로 fallback.
  // (marketplace / guilds / inbox 와 동일 dual-source 패턴)
  const missingNameUserIds = topRows
    .filter((r) => !r.name)
    .map((r) => r.userId);
  const profileNameByUser = new Map<string, string>();
  if (missingNameUserIds.length > 0) {
    const profRows = await db
      .select({ userId: savesKv.userId, value: savesKv.value })
      .from(savesKv)
      .where(
        and(
          inArray(savesKv.userId, missingNameUserIds),
          eq(savesKv.key, "character-profile.v2"),
        ),
      );
    for (const p of profRows) {
      const n = (p.value as { name?: unknown } | null)?.name;
      if (typeof n === "string" && n.trim()) {
        profileNameByUser.set(p.userId, n.trim());
      }
    }
  }

  // 최근 공격 로그 (모든 참여자, 최신 20) — 보스 카드 밑 활동 피드용.
  const recentLogs = await db
    .select({
      id: coopBossAttackLog.id,
      userId: coopBossAttackLog.userId,
      name: coopBossAttackLog.name,
      damageDealt: coopBossAttackLog.damageDealt,
      damageTaken: coopBossAttackLog.damageTaken,
      diedEarly: coopBossAttackLog.diedEarly,
      log: coopBossAttackLog.log,
      createdAt: coopBossAttackLog.createdAt,
    })
    .from(coopBossAttackLog)
    .where(eq(coopBossAttackLog.sessionId, session.id))
    .orderBy(sql`${coopBossAttackLog.createdAt} DESC`)
    .limit(20);

  const cooldownEndsAt = myRow?.lastAttackAt
    ? new Date(myRow.lastAttackAt.getTime() + COOP_ATTACK_COOLDOWN_MS)
    : null;
  const claimable =
    !!session.defeatedAt && !!myTier && !myRow?.claimedAt;

  return Response.json({
    session: {
      id: session.id,
      regionId: session.regionId,
      bossName: session.bossName,
      hp: session.hp,
      maxHp: session.maxHp,
      spawnedAt: session.spawnedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      defeatedAt: session.defeatedAt?.toISOString() ?? null,
      nextSpawnAt: session.nextSpawnAt?.toISOString() ?? null,
      isActive,
    },
    myContribution: myRow
      ? {
          damage: myRow.damage,
          attackCount: myRow.attackCount,
          ratio,
          tier: myTier,
          cooldownEndsAt: cooldownEndsAt?.toISOString() ?? null,
          claimable,
          claimedAt: myRow.claimedAt?.toISOString() ?? null,
          claimedTier: myRow.claimedTier as CoopRewardTier | null,
        }
      : null,
    top: topRows.map((r) => ({
      name: r.name ?? profileNameByUser.get(r.userId) ?? "모험가",
      damage: r.damage,
      attackCount: r.attackCount,
      mine: r.userId === userId,
    })),
    recentLogs: recentLogs.map((r) => ({
      id: r.id,
      name: r.name,
      damageDealt: r.damageDealt,
      damageTaken: r.damageTaken,
      diedEarly: r.diedEarly,
      log: r.log ?? [],
      createdAt: r.createdAt.toISOString(),
      mine: r.userId === userId,
    })),
  });
}

// POST /api/coop/[region] — attack 또는 claim.
export async function POST(req: Request, { params }: Ctx) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionGuard = await checkSession(userId, req);
  if (sessionGuard) return sessionGuard;
  const { region } = await params;
  if (!VALID_REGIONS.includes(region as RegionId)) {
    return new Response("invalid region", { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (body.action === "attack") return handleCoopAttack(userId, region, body);
  if (body.action === "claim") return handleCoopClaim(userId, region);
  return new Response("unknown action", { status: 400 });
}
