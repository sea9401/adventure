// POST /api/hunt/dispatch — 자동 사냥(4시간 원정) 시작.
//
// body: { autoPotionRules?: AutoPotionRule[] }  // 사망 예측 sim 정확도를 위해 디바이스 룰을 받음.
//   - region/hp 는 신뢰하지 않고 서버가 map.v2 / character.v2 에서 직접 읽음.
//
// 흐름:
//   tx1) users 잠금 — 이미 위탁 중이면 거부 / hp ≤ 0 / region 적 없음 → 거부.
//        통과 시 huntActive=true + baseline 박고 COMMIT.
//   pre-sim) 트랜잭션 밖에서 4시간치 sim 을 한 번 미리 돌려 사망 여부/시각 예측. 결정적이라
//        collect 시 같은 결과가 나옴(같은 baselineMs/seed). 사망이면 huntPredictedDeathAt 박음.
//        조건부 update — 사이에 다른 사이클이 끼었으면 NO-OP.
//        sim 실패해도 dispatch 자체는 성공 (알림만 못 받음, collect 결과는 정상 적용).
//
// 반환: { ok:true, startedAt, regionId, durationMs, predictedDeathAt } | { ok:false, reason }
//   - predictedDeathAt: ISO string (사망 예측 시각) 또는 null (생존).

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savesKv, users } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import {
  assembleSimInput,
  loadStateForSim,
  makeRng,
  updateBaseline,
} from "@/lib/server/autoHunt";
import {
  AUTO_HUNT_DURATION_MS,
  AUTO_HUNT_EFFICIENCY,
  applyAutoHuntEfficiency,
} from "@/adventure/battle/autoHunt";
import { simulateOfflineHunt } from "@/adventure/battle/offlineSim";
import type { AutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";
import {
  WORLD_MAP,
  START_REGION_ID,
  type RegionId,
} from "@/adventure/data/world";

type SavedCharacterV2 = { hp?: number };
type SavedMapV2 = { currentRegionId?: RegionId };
type DispatchBody = { autoPotionRules?: unknown };

type DispatchSuccess = {
  ok: true;
  startedAt: string;
  regionId: RegionId;
  durationMs: number;
  predictedDeathAt: string | null;
  baselineHp: number;
};
type DispatchFail = {
  ok: false;
  reason: "already_active" | "hp_zero" | "no_enemies" | "no_user";
};
type DispatchResponse = DispatchSuccess | DispatchFail;

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  let body: DispatchBody = {};
  try {
    body = (await req.json()) as DispatchBody;
  } catch {
    // body 없어도 OK.
  }
  const autoPotionRules: AutoPotionConfig["rules"] = Array.isArray(
    body.autoPotionRules,
  )
    ? (body.autoPotionRules as AutoPotionConfig["rules"])
    : [];

  try {
    const now = new Date();
    const baseline: DispatchResponse = await db.transaction(async (tx) => {
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
        huntPredictedDeathAt: null,
        lastClaimId: null,
        lastClaimResult: null,
      });
      return {
        ok: true,
        startedAt: now.toISOString(),
        regionId,
        durationMs: AUTO_HUNT_DURATION_MS,
        predictedDeathAt: null,
        baselineHp: hp,
      };
    });

    if (!baseline.ok) return Response.json(baseline);

    // tx 밖에서 pre-sim — 사망 시각 예측. 실패해도 dispatch 는 성공으로 응답.
    let predictedDeathAt: string | null = null;
    try {
      const state = await loadStateForSim(db, userId, false);
      if (state) {
        const baselineMs = now.getTime();
        const rng = makeRng(userId, baselineMs);
        const input = assembleSimInput({
          state,
          baselineHp: baseline.baselineHp,
          baselineRegionId: baseline.regionId,
          awayMs: AUTO_HUNT_DURATION_MS,
          rng,
          autoPotionRules,
          playerName: "모험가",
        });
        const raw = simulateOfflineHunt(input);
        // 효율 후처리는 사망 판정에 영향 없지만 결정성 유지를 위해 동일 rng 호출 (collect 와 일치).
        applyAutoHuntEfficiency(raw, AUTO_HUNT_EFFICIENCY, rng);
        if (raw.died) {
          const deathAt = new Date(baselineMs + raw.simulatedMs);
          // 조건부 update — 사이에 다른 dispatch/collect 가 끼어 baseline 이 바뀌었으면 NO-OP.
          await db
            .update(users)
            .set({ huntPredictedDeathAt: deathAt })
            .where(
              and(
                eq(users.id, userId),
                eq(users.huntActive, true),
                eq(users.huntBaselineAt, now),
              ),
            );
          predictedDeathAt = deathAt.toISOString();
        }
      }
    } catch (e) {
      console.error("[hunt.dispatch] pre-sim failed:", e);
    }

    return Response.json({
      ok: true,
      startedAt: baseline.startedAt,
      regionId: baseline.regionId,
      durationMs: baseline.durationMs,
      predictedDeathAt,
    });
  } catch (e) {
    console.error("[hunt.dispatch]", e);
    return new Response("internal error", { status: 500 });
  }
}
