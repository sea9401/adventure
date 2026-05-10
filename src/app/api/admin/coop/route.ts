import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { coopBossContributors, coopBossSessions } from "@/db/schema";
import { requireAdmin } from "@/lib/server/isAdmin";
import { COOP_BOSSES } from "@/adventure/coop/data";
import type { RegionId } from "@/adventure/data/world";

const VALID_REGIONS = Object.keys(COOP_BOSSES) as RegionId[];

type SpawnBody = { action: "spawn"; region: string; force?: boolean };
type EndBody = { action: "end"; region: string };
type SetHpBody = { action: "set_hp"; region: string; hp: number };
type Body = SpawnBody | EndBody | SetHpBody;

// GET — 전체 활성·최근 세션 + 기여자 카운트.
export async function GET() {
  const gate = await requireAdmin();
  if (gate) return gate;

  const sessions = await db
    .select()
    .from(coopBossSessions)
    .orderBy(sql`${coopBossSessions.spawnedAt} DESC`)
    .limit(20);

  const enriched = await Promise.all(
    sessions.map(async (s) => {
      const contribs = await db
        .select({ damage: coopBossContributors.damage })
        .from(coopBossContributors)
        .where(eq(coopBossContributors.sessionId, s.id));
      const totalDmg = contribs.reduce((a, c) => a + c.damage, 0);
      return {
        ...s,
        spawnedAt: s.spawnedAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        defeatedAt: s.defeatedAt?.toISOString() ?? null,
        nextSpawnAt: s.nextSpawnAt?.toISOString() ?? null,
        contributorCount: contribs.length,
        totalDamage: totalDmg,
      };
    }),
  );

  return Response.json({ sessions: enriched });
}

// POST — spawn / end / set_hp.
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate) return gate;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (!VALID_REGIONS.includes(body.region as RegionId)) {
    return new Response("invalid region", { status: 400 });
  }
  const def = COOP_BOSSES[body.region as RegionId];
  if (!def) return new Response("region has no coop boss", { status: 400 });

  const now = new Date();

  if (body.action === "spawn") {
    // 기존 활성 세션 있으면 force 가 true 일 때만 진행 (정리 후 새 spawn).
    const active = await db
      .select()
      .from(coopBossSessions)
      .where(
        and(
          eq(coopBossSessions.regionId, body.region),
          isNull(coopBossSessions.defeatedAt),
        ),
      )
      .limit(1);

    if (active.length > 0) {
      if (!body.force) {
        return Response.json(
          { error: "active session exists — pass force:true to replace" },
          { status: 409 },
        );
      }
      // 강제 정리 — 활성 세션 defeatedAt 마킹 (cascade 로 contributors 도 보존됨).
      await db
        .update(coopBossSessions)
        .set({
          defeatedAt: now,
          nextSpawnAt: new Date(now.getTime() + def.respawnMs),
        })
        .where(eq(coopBossSessions.id, active[0].id));
    }

    const newId = randomUUID();
    await db.insert(coopBossSessions).values({
      id: newId,
      regionId: body.region,
      bossName: def.monsterName,
      hp: def.maxHp,
      maxHp: def.maxHp,
      spawnedAt: now,
      expiresAt: new Date(now.getTime() + def.expirationMs),
    });
    return Response.json({ ok: true, sessionId: newId });
  }

  if (body.action === "end") {
    const r = await db
      .update(coopBossSessions)
      .set({
        defeatedAt: now,
        nextSpawnAt: new Date(now.getTime() + def.respawnMs),
      })
      .where(
        and(
          eq(coopBossSessions.regionId, body.region),
          isNull(coopBossSessions.defeatedAt),
        ),
      )
      .returning({ id: coopBossSessions.id });
    return Response.json({ ok: true, ended: r.length });
  }

  if (body.action === "set_hp") {
    const hp = Math.max(0, Math.floor(body.hp));
    const r = await db
      .update(coopBossSessions)
      .set({ hp })
      .where(
        and(
          eq(coopBossSessions.regionId, body.region),
          isNull(coopBossSessions.defeatedAt),
        ),
      )
      .returning({ id: coopBossSessions.id });
    return Response.json({ ok: true, updated: r.length });
  }

  return new Response("unknown action", { status: 400 });
}
