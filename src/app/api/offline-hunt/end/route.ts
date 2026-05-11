// POST /api/offline-hunt/end — 자동 사냥 OFF / region 이동 / 사망 직후 등 명시 종료.
//
// body: { claimId: string, autoPotionRules?: AutoPotionRule[], playerName?: string,
//         reason?: "toggle"|"region-change"|"death" }
//
// claim 과 동일하게 sim + 결과 적용 후, 마지막에 huntActive=false / baseline NULL 로 마무리.
// reason 은 디버그 텔레메트리용 (로깅만, 분기 없음).

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import {
  CLAIM_MIN_AWAY_MS,
  applyResultToSaves,
  assembleSimInput,
  hasMeaningfulResult,
  loadStateForSim,
  makeRng,
  updateBaseline,
} from "@/lib/server/offlineHunt";
import { simulateOfflineHunt } from "@/adventure/battle/offlineSim";
import type { OfflineSimResult } from "@/adventure/battle/offlineSim";
import type { AutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";
import type { RegionId } from "@/adventure/data/world";

type EndBody = {
  claimId?: unknown;
  autoPotionRules?: unknown;
  playerName?: unknown;
  reason?: unknown;
};

type EndResponse =
  | { ok: true; hadReward: false; noop: true; reason: string }
  | { ok: true; hadReward: boolean; result: OfflineSimResult };

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  let body: EndBody;
  try {
    body = (await req.json()) as EndBody;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (typeof body.claimId !== "string" || body.claimId.length === 0) {
    return new Response("missing claimId", { status: 400 });
  }
  const claimId = body.claimId;
  const autoPotionRules: AutoPotionConfig["rules"] = Array.isArray(
    body.autoPotionRules,
  )
    ? (body.autoPotionRules as AutoPotionConfig["rules"])
    : [];
  const playerName =
    typeof body.playerName === "string" && body.playerName.length > 0
      ? body.playerName
      : "모험가";

  try {
    const response: EndResponse = await db.transaction(async (tx) => {
      const uRows = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (uRows.length === 0) {
        // active=false 로 보장하고 끝.
        return { ok: true, hadReward: false, noop: true, reason: "no_user" };
      }
      const u = uRows[0];

      // 멱등.
      if (u.lastClaimId === claimId && u.lastClaimResult) {
        const cached = u.lastClaimResult as OfflineSimResult;
        return {
          ok: true,
          hadReward: hasMeaningfulResult(cached),
          result: cached,
        };
      }

      // 비활성이면 그냥 baseline 클리어 + active=false.
      if (!u.huntActive || !u.huntBaselineAt) {
        await updateBaseline(tx, userId, {
          huntActive: false,
          huntRegion: null,
          huntBaselineHp: null,
          huntBaselineAt: null,
          lastClaimId: claimId,
          lastClaimResult: null,
        });
        return { ok: true, hadReward: false, noop: true, reason: "inactive" };
      }

      const baselineMs = u.huntBaselineAt.getTime();
      const now = new Date();
      const awayMs = now.getTime() - baselineMs;
      if (awayMs < CLAIM_MIN_AWAY_MS) {
        // 너무 짧으면 sim 안 돌리고 active=false 만.
        await updateBaseline(tx, userId, {
          huntActive: false,
          huntRegion: null,
          huntBaselineHp: null,
          huntBaselineAt: null,
          lastClaimId: claimId,
          lastClaimResult: null,
        });
        return { ok: true, hadReward: false, noop: true, reason: "too_short" };
      }

      const state = await loadStateForSim(tx, userId);
      if (!state) {
        await updateBaseline(tx, userId, {
          huntActive: false,
          huntRegion: null,
          huntBaselineHp: null,
          huntBaselineAt: null,
          lastClaimId: claimId,
          lastClaimResult: null,
        });
        return { ok: true, hadReward: false, noop: true, reason: "no_state" };
      }

      const rng = makeRng(userId, baselineMs);
      const baselineHp = u.huntBaselineHp ?? state.character.hp ?? 0;
      const baselineRegionId = (u.huntRegion ?? state.map.currentRegionId) as
        | RegionId
        | undefined;
      if (!baselineRegionId) {
        await updateBaseline(tx, userId, {
          huntActive: false,
          huntRegion: null,
          huntBaselineHp: null,
          huntBaselineAt: null,
          lastClaimId: claimId,
          lastClaimResult: null,
        });
        return { ok: true, hadReward: false, noop: true, reason: "no_region" };
      }

      const input = assembleSimInput({
        state,
        baselineHp,
        baselineRegionId,
        awayMs,
        rng,
        autoPotionRules,
        playerName,
      });
      const result = simulateOfflineHunt(input);

      await applyResultToSaves(tx, userId, {
        state,
        result,
        died: result.died,
      });

      // 항상 active=false 로 마무리.
      await updateBaseline(tx, userId, {
        huntActive: false,
        huntRegion: null,
        huntBaselineHp: null,
        huntBaselineAt: null,
        lastClaimId: claimId,
        lastClaimResult: result,
      });

      return {
        ok: true,
        hadReward: hasMeaningfulResult(result),
        result,
      };
    });

    return Response.json(response);
  } catch (e) {
    console.error("[offline-hunt.end]", e);
    return new Response("internal error", { status: 500 });
  }
}
