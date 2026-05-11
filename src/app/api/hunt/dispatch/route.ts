// POST /api/hunt/dispatch — 자동 사냥(1시간 원정) 시작.
//
// body: 없음. region/hp 는 신뢰하지 않고 서버가 map.v2 / character.v2 에서 직접 읽음.
//
// 흐름:
//   1) auth
//   2) 트랜잭션 안에서 users row 잠금 — 이미 위탁 중이면 거부
//   3) character.v2 hp ≤ 0 → 거부 / map.v2 region 에 적 없음 → 거부
//   4) huntActive=true, huntBaselineAt=now, huntRegion, huntBaselineHp 박음 + lastClaim* 초기화
// 반환: { ok: true, startedAt, regionId, durationMs } | { ok: false, reason }

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savesKv, users } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import { updateBaseline } from "@/lib/server/autoHunt";
import { AUTO_HUNT_DURATION_MS } from "@/adventure/battle/autoHunt";
import {
  WORLD_MAP,
  START_REGION_ID,
  type RegionId,
} from "@/adventure/data/world";

type SavedCharacterV2 = { hp?: number };
type SavedMapV2 = { currentRegionId?: RegionId };

type DispatchResponse =
  | { ok: true; startedAt: string; regionId: RegionId; durationMs: number }
  | { ok: false; reason: "already_active" | "hp_zero" | "no_enemies" | "no_user" };

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  try {
    const now = new Date();
    const response: DispatchResponse = await db.transaction(async (tx) => {
      const uRows = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (uRows.length === 0) return { ok: false, reason: "no_user" };
      if (uRows[0].huntActive) return { ok: false, reason: "already_active" };

      const charRows = await tx
        .select({ value: savesKv.value })
        .from(savesKv)
        .where(and(eq(savesKv.userId, userId), eq(savesKv.key, "character.v2")))
        .limit(1);
      const character = (charRows[0]?.value as SavedCharacterV2 | undefined) ?? {};
      const hp = Math.max(0, character.hp ?? 0);
      if (hp <= 0) return { ok: false, reason: "hp_zero" };

      const mapRows = await tx
        .select({ value: savesKv.value })
        .from(savesKv)
        .where(and(eq(savesKv.userId, userId), eq(savesKv.key, "map.v2")))
        .limit(1);
      const map = (mapRows[0]?.value as SavedMapV2 | undefined) ?? {};
      const regionId = (map.currentRegionId ?? START_REGION_ID) as RegionId;
      const region = WORLD_MAP.regions.find((r) => r.id === regionId);
      if (!region || region.enemies.length === 0) {
        return { ok: false, reason: "no_enemies" };
      }

      await updateBaseline(tx, userId, {
        huntActive: true,
        huntRegion: regionId,
        huntBaselineHp: hp,
        huntBaselineAt: now,
        lastClaimId: null,
        lastClaimResult: null,
      });
      return {
        ok: true,
        startedAt: now.toISOString(),
        regionId,
        durationMs: AUTO_HUNT_DURATION_MS,
      };
    });
    return Response.json(response);
  } catch (e) {
    console.error("[hunt.dispatch]", e);
    return new Response("internal error", { status: 500 });
  }
}
