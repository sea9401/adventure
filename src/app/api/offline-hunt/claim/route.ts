// POST /api/offline-hunt/claim — 복귀 시 호출. 트랜잭션 안에서 baseline 부터 NOW 까지 sim 실행 + 결과 적용.
//
// body: { claimId: string, autoPotionRules?: AutoPotionRule[], playerName?: string }
//   - claimId: ULID 또는 임의 고유 토큰. 같은 ID 재호출 시 sim 재실행 없이 저장된 결과 반환 (멱등).
//   - autoPotionRules: 디바이스별 설정이라 서버에 동기화 안 됨 — 클라가 보냄. 안 보내면 빈 룰.
//   - playerName: 로그용. 기본 "모험가".
//
// 흐름:
//   1) auth
//   2) 트랜잭션 안에서 users row + 모든 save 키 잠금
//   3) 멱등 체크 — lastClaimId === claimId 면 lastClaimResult 그대로 반환
//   4) huntActive=false 또는 huntBaselineAt null → noop
//   5) awayMs < 10s → noop
//   6) loadStateForSim + assembleSimInput + simulateOfflineHunt
//   7) applyResultToSaves → savesKv upsert (version++)
//   8) baseline advance (huntBaselineAt=NOW, huntBaselineHp=finalPlayerHp, huntActive 유지)
//   9) 사망이면 huntActive=false 로 마무리 + map.v2 의 region 갱신은 applyResultToSaves 가 처리
//   10) lastClaimId/lastClaimResult 저장 (멱등)

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

type ClaimBody = {
  claimId?: unknown;
  autoPotionRules?: unknown;
  playerName?: unknown;
  // 현재 클라 region — sim 은 stored baseline.region 으로 돌고, 끝난 후 baseline.region 을
  // 이 값으로 advance. 사용자가 map 으로 다른 region 이동했을 때 다음 사이클이 새 region 으로
  // 잡히도록. 옛 흐름에서 useOfflineSimulation 이 매 effect run 마다 baseline 을 rewrite 하던
  // 역할을 한 번에 처리. (옵션 — 미동봉이면 region 유지.)
  currentRegion?: unknown;
};

type ClaimResponse =
  | { ok: true; hadReward: false; noop: true; reason: string }
  | { ok: true; hadReward: boolean; result: OfflineSimResult };

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  let body: ClaimBody;
  try {
    body = (await req.json()) as ClaimBody;
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
  const clientRegion =
    typeof body.currentRegion === "string" && body.currentRegion.length > 0
      ? (body.currentRegion as RegionId)
      : null;

  try {
    const response: ClaimResponse = await db.transaction(async (tx) => {
      // users row 잠금.
      const uRows = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (uRows.length === 0) {
        return { ok: true, hadReward: false, noop: true, reason: "no_user" };
      }
      const u = uRows[0];

      // 멱등 — 같은 claimId 재호출이면 저장된 결과 그대로.
      if (u.lastClaimId === claimId && u.lastClaimResult) {
        const cached = u.lastClaimResult as OfflineSimResult;
        return {
          ok: true,
          hadReward: hasMeaningfulResult(cached),
          result: cached,
        };
      }

      if (!u.huntActive || !u.huntBaselineAt) {
        return { ok: true, hadReward: false, noop: true, reason: "inactive" };
      }
      const baselineMs = u.huntBaselineAt.getTime();
      const now = new Date();
      const awayMs = now.getTime() - baselineMs;
      if (awayMs < CLAIM_MIN_AWAY_MS) {
        return { ok: true, hadReward: false, noop: true, reason: "too_short" };
      }

      const state = await loadStateForSim(tx, userId);
      if (!state) {
        return { ok: true, hadReward: false, noop: true, reason: "no_state" };
      }

      const rng = makeRng(userId, baselineMs);
      const baselineHp = u.huntBaselineHp ?? state.character.hp ?? 0;
      const baselineRegionId = (u.huntRegion ?? state.map.currentRegionId) as
        | RegionId
        | undefined;
      if (!baselineRegionId) {
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

      // 결과 적용.
      const outcome = await applyResultToSaves(tx, userId, {
        state,
        result,
        died: result.died,
      });

      // baseline advance — 사망이면 active=false, 아니면 ts=NOW + hp 갱신.
      if (result.died) {
        await updateBaseline(tx, userId, {
          huntActive: false,
          huntRegion: null,
          huntBaselineHp: null,
          huntBaselineAt: null,
          lastClaimId: claimId,
          lastClaimResult: result,
        });
      } else {
        await updateBaseline(tx, userId, {
          huntBaselineAt: now,
          huntBaselineHp: outcome.newCharacter.hp ?? null,
          // 클라가 새 region 을 알려줬으면 baseline.region 도 그 값으로 advance.
          ...(clientRegion ? { huntRegion: clientRegion } : {}),
          lastClaimId: claimId,
          lastClaimResult: result,
        });
      }

      return {
        ok: true,
        hadReward: hasMeaningfulResult(result),
        result,
      };
    });

    return Response.json(response);
  } catch (e) {
    console.error("[offline-hunt.claim]", e);
    return new Response("internal error", { status: 500 });
  }
}
