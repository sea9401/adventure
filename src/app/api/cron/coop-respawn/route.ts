import { and, isNull, lt, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { coopBossSessions, messages, users } from "@/db/schema";
import { COOP_BOSSES } from "@/adventure/coop/data";

// 시스템 broadcast 용 가짜 유저 — messages.userId 가 NOT NULL + users.id FK 라
// 시스템 글도 어떤 user row 를 참조해야 함. id="system" 으로 한 번만 INSERT 해
// 두고 spawn 알림에 재사용.
const SYSTEM_USER_ID = "system";
async function ensureSystemUser(): Promise<void> {
  await db
    .insert(users)
    .values({ id: SYSTEM_USER_ID, email: null, name: null })
    .onConflictDoNothing({ target: users.id });
}

// 매시간 실행 — 만료/처치된 세션 정리 + nextSpawnAt 도달한 region 에 새 세션 생성.
//
// 1) 만료 처리: defeatedAt IS NULL && expiresAt < now → defeatedAt = now (유저는 못 잡았지만 청소).
//    nextSpawnAt = now + respawnMs.
// 2) 새 세션 생성: 활성 세션 없는 region (defeatedAt IS NOT NULL 인 마지막 세션의 nextSpawnAt 도달 또는 첫 등장) 에 spawn.
//
// 멱등 — 두 번 실행돼도 활성 세션 unique 인덱스로 중복 생성 차단.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const now = new Date();
  const expired: string[] = [];
  const spawned: string[] = [];

  // 1) 만료 처리.
  for (const [regionId, def] of Object.entries(COOP_BOSSES)) {
    if (!def) continue;
    const expiredRows = await db
      .update(coopBossSessions)
      .set({
        defeatedAt: now,
        nextSpawnAt: new Date(now.getTime() + def.respawnMs),
      })
      .where(
        and(
          isNull(coopBossSessions.defeatedAt),
          lt(coopBossSessions.expiresAt, now),
          sql`${coopBossSessions.regionId} = ${regionId}`,
        ),
      )
      .returning({ id: coopBossSessions.id });
    for (const r of expiredRows) expired.push(r.id);
  }

  // 2) 새 세션 생성 — 활성 없는 region 에 spawn.
  for (const [regionId, def] of Object.entries(COOP_BOSSES)) {
    if (!def) continue;
    // 활성 세션 있나? (defeatedAt IS NULL && expiresAt > now)
    const active = await db
      .select({ id: coopBossSessions.id })
      .from(coopBossSessions)
      .where(
        and(
          sql`${coopBossSessions.regionId} = ${regionId}`,
          isNull(coopBossSessions.defeatedAt),
        ),
      )
      .limit(1);
    if (active.length > 0) continue;

    // 가장 최근 처치/만료된 세션의 nextSpawnAt 가 도달했는지 확인.
    const lastDefeated = await db
      .select({ nextSpawnAt: coopBossSessions.nextSpawnAt })
      .from(coopBossSessions)
      .where(sql`${coopBossSessions.regionId} = ${regionId}`)
      .orderBy(sql`${coopBossSessions.spawnedAt} DESC`)
      .limit(1);

    if (lastDefeated.length > 0) {
      const next = lastDefeated[0].nextSpawnAt;
      if (next && next > now) continue; // 아직 대기 중.
    }

    // 새 세션 생성.
    const newId = randomUUID();
    try {
      await db.insert(coopBossSessions).values({
        id: newId,
        regionId,
        bossName: def.monsterName,
        hp: def.maxHp,
        maxHp: def.maxHp,
        spawnedAt: now,
        expiresAt: new Date(now.getTime() + def.expirationMs),
      });
      spawned.push(newId);
      // 채팅 broadcast — 부수 효과라 실패해도 cron 응답은 정상.
      try {
        await ensureSystemUser();
        await db.insert(messages).values({
          userId: SYSTEM_USER_ID,
          name: "시스템",
          className: "협동 보스",
          title: null,
          content: `${def.monsterName}이(가) 나타났다 — 24시간 안에 쓰러뜨려야 한다.`,
        });
      } catch (err) {
        console.warn("[coop] spawn broadcast failed", err);
      }
    } catch {
      // 동시 cron 호출에서 unique 인덱스 위반 — silent skip.
    }
  }

  return Response.json({
    ok: true,
    expired: expired.length,
    spawned: spawned.length,
  });
}
