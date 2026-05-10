import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coopBossContributors,
  coopBossSessions,
  savesKv,
  users,
} from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { upsertSave } from "@/lib/server/savesKv";
import {
  COOP_ATTACK_COOLDOWN_MS,
  COOP_BOSSES,
  coopTierForRatio,
  type CoopRewardTier,
} from "@/adventure/coop/data";
import { computeCoopReward } from "@/adventure/coop/rewards";
import { simulateCoopAttack } from "@/adventure/coop/simulate";
import type { PlayerCombat } from "@/adventure/battle/engine";
import type { RegionId } from "@/adventure/data/world";

const VALID_REGIONS = Object.keys(COOP_BOSSES) as RegionId[];

type Ctx = { params: Promise<{ region: string }> };

// 본문이 client 에서 보내는 PlayerCombat 그대로 (서버에서 신뢰 — 추후 서버 스탯 derive 로 교체 권장).
type AttackBody = { action: "attack"; player: PlayerCombat; playerName: string };
type ClaimBody = { action: "claim" };
type Body = AttackBody | ClaimBody;

// GET /api/coop/[region] — 활성 세션 + 본인 기여 + top contributors.
export async function GET(_req: Request, { params }: Ctx) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const { region } = await params;
  if (!VALID_REGIONS.includes(region as RegionId)) {
    return new Response("invalid region", { status: 400 });
  }

  // 활성 세션 (defeatedAt IS NULL) 우선, 없으면 가장 최근 정리된 세션 (nextSpawnAt 정보 표시용).
  const active = await db
    .select()
    .from(coopBossSessions)
    .where(
      and(
        eq(coopBossSessions.regionId, region),
        isNull(coopBossSessions.defeatedAt),
      ),
    )
    .limit(1);

  let session = active[0];
  let isActive = !!session;

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
      name: users.name,
    })
    .from(coopBossContributors)
    .leftJoin(users, eq(users.id, coopBossContributors.userId))
    .where(eq(coopBossContributors.sessionId, session.id))
    .orderBy(sql`${coopBossContributors.damage} DESC`)
    .limit(5);

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
      name: r.name ?? "이름 없음",
      damage: r.damage,
      attackCount: r.attackCount,
      mine: r.userId === userId,
    })),
  });
}

// POST /api/coop/[region] — attack 또는 claim.
export async function POST(req: Request, { params }: Ctx) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
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

  if (body.action === "attack") return handleAttack(userId, region, body);
  if (body.action === "claim") return handleClaim(userId, region);
  return new Response("unknown action", { status: 400 });
}

async function handleAttack(
  userId: string,
  region: string,
  body: AttackBody,
): Promise<Response> {
  const def = COOP_BOSSES[region as RegionId];
  if (!def) return new Response("region has no coop boss", { status: 400 });

  // 활성 세션 확인.
  const active = await db
    .select()
    .from(coopBossSessions)
    .where(
      and(
        eq(coopBossSessions.regionId, region),
        isNull(coopBossSessions.defeatedAt),
      ),
    )
    .limit(1);
  const session = active[0];
  if (!session) return new Response("no active boss", { status: 404 });
  if (session.expiresAt < new Date()) {
    return new Response("session expired", { status: 410 });
  }
  if (session.hp <= 0) return new Response("already defeated", { status: 409 });

  // 쿨다운 확인.
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
  if (myRow?.lastAttackAt) {
    const next = myRow.lastAttackAt.getTime() + COOP_ATTACK_COOLDOWN_MS;
    if (Date.now() < next) {
      return Response.json(
        { error: "cooldown", retryAfter: next - Date.now() },
        { status: 429 },
      );
    }
  }

  // 시뮬 — 클라이언트가 보낸 player stat 그대로 사용.
  // (TODO: 서버에서 character.v2 + 장비 + 스킬 derive 로 검증 — 현재는 신뢰)
  const result = simulateCoopAttack({
    player: body.player,
    playerName: body.playerName ?? "모험가",
    bossName: session.bossName,
    bossCurrentHp: session.hp,
    bossMaxHp: session.maxHp,
    turns: 20,
  });

  // 세션 hp 차감 + contributor UPSERT — 단일 트랜잭션.
  const newHp = Math.max(0, session.hp - result.damageDealt);
  const defeated = newHp === 0;
  const now = new Date();

  await db.transaction(async (tx) => {
    // 세션 hp / defeatedAt 업데이트 (CAS — 다른 공격이 끼어들었으면 적용된 차감이 맞도록 raw UPDATE).
    await tx
      .update(coopBossSessions)
      .set({
        hp: sql`GREATEST(0, ${coopBossSessions.hp} - ${result.damageDealt})`,
        defeatedAt: defeated ? now : null,
        nextSpawnAt: defeated
          ? new Date(now.getTime() + def.respawnMs)
          : null,
      })
      .where(eq(coopBossSessions.id, session.id));

    // contributor UPSERT — 누적 데미지 / 공격 횟수 / lastAttackAt.
    await tx
      .insert(coopBossContributors)
      .values({
        sessionId: session.id,
        userId,
        damage: result.damageDealt,
        attackCount: 1,
        lastAttackAt: now,
      })
      .onConflictDoUpdate({
        target: [coopBossContributors.sessionId, coopBossContributors.userId],
        set: {
          damage: sql`${coopBossContributors.damage} + ${result.damageDealt}`,
          attackCount: sql`${coopBossContributors.attackCount} + 1`,
          lastAttackAt: now,
        },
      });
  });

  // 처치 시 storyFlag set — savesKv 의 storyFlags.v1 갱신.
  // (서버에서 직접 patch — 클라이언트 상태와 다음 fetch 에 반영)
  if (defeated && def.onDefeatFlag) {
    await setStoryFlagServer(userId, def.onDefeatFlag);
  }

  return Response.json({
    damageDealt: result.damageDealt,
    damageTaken: result.damageTaken,
    finalPlayerHp: result.finalPlayerHp,
    diedEarly: result.diedEarly,
    log: result.log,
    session: { hp: newHp, defeated },
  });
}

async function handleClaim(userId: string, region: string): Promise<Response> {
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

  const reward = computeCoopReward(session.bossName, tier);

  // claim 마킹.
  await db
    .update(coopBossContributors)
    .set({ claimedAt: new Date(), claimedTier: tier })
    .where(
      and(
        eq(coopBossContributors.sessionId, session.id),
        eq(coopBossContributors.userId, userId),
      ),
    );

  return Response.json({ tier, ratio, reward });
}

// storyFlag 서버 set — savesKv 의 storyFlags.v1 row 갱신.
// 클라이언트가 다음 reload 에서 useSavedValue 로 가져가 반영.
async function setStoryFlagServer(userId: string, flagId: string): Promise<void> {
  const STORAGE_KEY = "storyFlags.v1";
  // 기존 값 조회 → 합치기 → upsertSave.
  const existing = await db
    .select({ value: savesKv.value })
    .from(savesKv)
    .where(and(eq(savesKv.userId, userId), eq(savesKv.key, STORAGE_KEY)))
    .limit(1);
  const value = existing[0]?.value as { flags?: unknown } | undefined;
  const flags: string[] = Array.isArray(value?.flags)
    ? (value.flags as string[])
    : [];
  if (flags.includes(flagId)) return;
  flags.push(flagId);
  await upsertSave(db, userId, STORAGE_KEY, { flags });
}
