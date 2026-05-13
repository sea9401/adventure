// 협동 토벌 보스 — attack 액션 처리.
//
// 클라는 playerName 만 보내고 PlayerCombat 은 서버에서 character.v2 + training.v2 로
// 재계산(위변조 방지). 세션 hp 차감 + contributor UPSERT + 공격 로그를 단일 트랜잭션으로
// 처리하고, 처치(defeated) 판정은 SELECT 시점의 stale hp 가 아니라 UPDATE 의 실제 결과(CAS)로 한다.

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  coopBossAttackLog,
  coopBossContributors,
  coopBossSessions,
} from "@/db/schema";
import { derivePlayerCombatFromSaves } from "@/lib/server/derivePlayerCombatFromSaves";
import { COOP_ATTACK_COOLDOWN_MS, COOP_BOSSES } from "@/adventure/coop/data";
import { simulateCoopAttack } from "@/adventure/coop/simulate";
import type { RegionId } from "@/adventure/data/world";
import { broadcastBossKill, setStoryFlagServer } from "./bossState";

export type CoopAttackBody = { action: "attack"; playerName: string };

export async function handleCoopAttack(
  userId: string,
  region: string,
  body: CoopAttackBody,
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
  // 처치(defeated) 판정은 SELECT 시점의 stale session.hp 가 아니라 UPDATE 의 실제 결과로 한다.
  // (이전 버그: 동시 공격 두 건이 각자 stale hp 로 defeated 를 계산 →
  //  ① 둘 다 true 면 broadcast/storyFlag 가 중복 실행,
  //  ② 둘 다 false 인데 합산으로 hp 가 0 이 되면 defeatedAt 이 NULL 인 채 "죽었지만 못 받는" 보스가 됨.)
  const now = new Date();
  let realHp = Math.max(0, session.hp - result.damageDealt);
  let iClaimedKill = false;

  await db.transaction(async (tx) => {
    // 1. 원자적 hp 차감 — RETURNING 으로 실제 적용된 결과를 받는다.
    //    READ COMMITTED 에서 같은 row 의 동시 UPDATE 는 직렬화되므로 GREATEST 는 직전 커밋 반영값을 본다.
    const [updated] = await tx
      .update(coopBossSessions)
      .set({
        hp: sql`GREATEST(0, ${coopBossSessions.hp} - ${result.damageDealt})`,
      })
      .where(eq(coopBossSessions.id, session.id))
      .returning({ hp: coopBossSessions.hp });
    realHp = updated?.hp ?? realHp;

    // 2. 처치 CAS — hp 가 0 이고 아직 아무도 처치하지 않았을 때만 한 명이 점유.
    //    여기서 row 를 받은 1건만 iClaimedKill=true → broadcast/storyFlag 1회.
    if (realHp === 0) {
      const [claimed] = await tx
        .update(coopBossSessions)
        .set({
          defeatedAt: now,
          nextSpawnAt: new Date(now.getTime() + def.respawnMs),
        })
        .where(
          and(
            eq(coopBossSessions.id, session.id),
            isNull(coopBossSessions.defeatedAt),
          ),
        )
        .returning({ id: coopBossSessions.id });
      iClaimedKill = !!claimed;
    }

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

    // 공격 로그 1줄 — 다른 사람도 보스 카드 밑에서 볼 수 있게. log 는 BattleLogEntry[] 그대로.
    await tx.insert(coopBossAttackLog).values({
      sessionId: session.id,
      userId,
      name: body.playerName ?? "모험가",
      damageDealt: result.damageDealt,
      damageTaken: result.damageTaken,
      diedEarly: result.diedEarly,
      log: result.log,
      createdAt: now,
    });
  });

  // 처치 시 storyFlag set — savesKv 의 storyFlags.v2 갱신. CAS 로 처치를 점유한 1명만.
  // (서버에서 직접 patch — 클라이언트 상태와 다음 fetch 에 반영)
  // 추가로 set 한 flag 를 응답에 실어 보내 클라가 메모리 상태에도 즉시 반영하게 한다 —
  // 안 그러면 reload 전까지 운향 진입로 등이 안 열린다 (useStoryFlags 는 마운트 스냅샷).
  const storyFlagsSet: string[] = [];
  if (iClaimedKill && def.onDefeatFlag) {
    await setStoryFlagServer(userId, def.onDefeatFlag);
    storyFlagsSet.push(def.onDefeatFlag);
  }
  // 1회 이상 attack 한 유저에게 set 되는 참여 flag — idempotent (이미 있으면 skip).
  if (def.onAttackFlag) {
    await setStoryFlagServer(userId, def.onAttackFlag);
    storyFlagsSet.push(def.onAttackFlag);
  }

  // 처치 broadcast — 광장 게시판에 1줄 시스템 글. CAS 로 처치를 점유한 1명만.
  if (iClaimedKill) {
    await broadcastBossKill(userId, session.id, session.bossName).catch(
      (err) => {
        // 부수 효과 — 실패해도 attack 응답은 정상 처리.
        console.warn("[coop] broadcast failed", err);
      },
    );
  }

  return Response.json({
    damageDealt: result.damageDealt,
    damageTaken: result.damageTaken,
    finalPlayerHp: result.finalPlayerHp,
    diedEarly: result.diedEarly,
    log: result.log,
    session: { hp: realHp, defeated: realHp === 0 },
    storyFlagsSet,
  });
}
