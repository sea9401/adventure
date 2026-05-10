import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coopBossAttackLog,
  coopBossContributors,
  coopBossSessions,
  messages,
  savesKv,
  users,
} from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { upsertSave } from "@/lib/server/savesKv";
import { derivePlayerCombatFromSaves } from "@/lib/server/derivePlayerCombatFromSaves";
import {
  COOP_ATTACK_COOLDOWN_MS,
  COOP_BOSSES,
  coopTierForRatio,
  type CoopRewardTier,
} from "@/adventure/coop/data";
import { computeCoopReward } from "@/adventure/coop/rewards";
import { simulateCoopAttack } from "@/adventure/coop/simulate";
import type { RegionId } from "@/adventure/data/world";

const VALID_REGIONS = Object.keys(COOP_BOSSES) as RegionId[];

type Ctx = { params: Promise<{ region: string }> };

// playerName 만 클라가 보내고, PlayerCombat 은 서버에서 character.v2 + training.v2 로 재계산.
// (이전: 클라가 PlayerCombat 그대로 — 위변조로 데미지 부풀리기 가능했음)
type AttackBody = { action: "attack"; playerName: string };
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

  // users.name 이 NULL 인 레거시 유저 — character-profile.v2.name 으로 fallback.
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
      createdAt: r.createdAt.toISOString(),
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

  // 서버측 PlayerCombat 재계산 — 저장된 character.v2 + training.v2 로 derive.
  // (클라가 보낸 stat 은 더 이상 신뢰하지 않음)
  const derived = await derivePlayerCombatFromSaves(userId);
  if (!derived) {
    return new Response("character not found", { status: 404 });
  }
  if (derived.player.hp <= 0) {
    return new Response("character is incapacitated", { status: 409 });
  }

  const result = simulateCoopAttack({
    player: derived.player,
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

    // 공격 로그 1줄 — 다른 사람도 보스 카드 밑에서 볼 수 있게.
    await tx.insert(coopBossAttackLog).values({
      sessionId: session.id,
      userId,
      name: body.playerName ?? "모험가",
      damageDealt: result.damageDealt,
      damageTaken: result.damageTaken,
      diedEarly: result.diedEarly,
      createdAt: now,
    });
  });

  // 처치 시 storyFlag set — savesKv 의 storyFlags.v1 갱신.
  // (서버에서 직접 patch — 클라이언트 상태와 다음 fetch 에 반영)
  if (defeated && def.onDefeatFlag) {
    await setStoryFlagServer(userId, def.onDefeatFlag);
  }
  // 1회 이상 attack 한 유저에게 set 되는 참여 flag — idempotent (이미 있으면 skip).
  if (def.onAttackFlag) {
    await setStoryFlagServer(userId, def.onAttackFlag);
  }

  // 처치 broadcast — 광장 게시판에 1줄 시스템 글.
  if (defeated) {
    await broadcastBossKill(userId, session.id, session.bossName).catch((err) => {
      // 부수 효과 — 실패해도 attack 응답은 정상 처리.
      console.warn("[coop] broadcast failed", err);
    });
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

// 처치 broadcast — 채팅에 1줄 시스템 글.
async function broadcastBossKill(
  killerId: string,
  sessionId: string,
  bossName: string,
): Promise<void> {
  const contribs = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(coopBossContributors)
    .where(eq(coopBossContributors.sessionId, sessionId));
  const count = Number(contribs[0]?.count ?? 0);

  const killer = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, killerId))
    .limit(1);
  let killerName = killer[0]?.name ?? null;
  if (!killerName) {
    const [profRow] = await db
      .select({ value: savesKv.value })
      .from(savesKv)
      .where(
        and(
          eq(savesKv.userId, killerId),
          eq(savesKv.key, "character-profile.v2"),
        ),
      )
      .limit(1);
    const n = (profRow?.value as { name?: unknown } | null)?.name;
    if (typeof n === "string" && n.trim()) killerName = n.trim();
  }
  if (!killerName) killerName = "이름 없는 모험가";

  await db.insert(messages).values({
    userId: killerId,
    name: killerName,
    className: "협동 토벌",
    title: null,
    content: `${bossName}이(가) 쓰러졌다 — 마지막 일격: ${killerName} · 기여자 ${count}명`,
  });
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
