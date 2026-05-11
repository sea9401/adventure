// POST /api/hunt/collect — 자동 사냥(1시간 원정) 수령 (조기 수령 겸용).
//
// body: { playerName?: string, autoPotionRules?: AutoPotionRule[] }
//   - playerName: 전투 로그용 (안 보내면 "모험가")
//   - autoPotionRules: 디바이스별 자동 포션 룰 — sim 에 그대로 전달 (서버에 동기화 안 됨)
//
// 흐름:
//   1) auth
//   2) 트랜잭션 안에서 users row + 모든 save 키 잠금
//   3) huntActive 아님 → lastClaimResult 있으면 replay, 없으면 noop("inactive")
//   4) simMs = min(NOW - huntBaselineAt, 1시간). simMs < 10초 → noop("too_soon")
//   5) loadStateForSim + assembleSimInput(autoPotion 룰 + maxBattles 적용) + simulateOfflineHunt(awayMs=simMs)
//   6) 효율 후처리 (AUTO_HUNT_EFFICIENCY, 같은 rng 스트림 이어받아 결정적)
//   7) applyResultToSaves (HP 델타 / 사망 시 0+respawn)
//   8) huntActive=false, baseline NULL, lastClaimResult=결과 캐시 (lost-response 재시도 replay 용)
// 반환: { ok:true, result, hadReward, died, simMs } | { ok:true, noop:true, reason } | { ok:true, replayed:true, ... }

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import {
  applyResultToSaves,
  assembleSimInput,
  hasMeaningfulResult,
  loadStateForSim,
  makeRng,
  updateBaseline,
} from "@/lib/server/autoHunt";
import {
  AUTO_HUNT_DURATION_MS,
  AUTO_HUNT_EFFICIENCY,
  AUTO_HUNT_MIN_COLLECT_MS,
  applyAutoHuntEfficiency,
} from "@/adventure/battle/autoHunt";
import { simulateOfflineHunt } from "@/adventure/battle/offlineSim";
import type { OfflineSimResult } from "@/adventure/battle/offlineSim";
import type { AutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";
import type { RegionId } from "@/adventure/data/world";

type CollectBody = { playerName?: unknown; autoPotionRules?: unknown };

type CollectResponse =
  | { ok: true; noop: true; reason: string }
  | { ok: true; replayed: true; hadReward: boolean; result: OfflineSimResult; died: boolean; simMs: number }
  | { ok: true; hadReward: boolean; result: OfflineSimResult; died: boolean; simMs: number };

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  let body: CollectBody = {};
  try {
    body = (await req.json()) as CollectBody;
  } catch {
    // body 없어도 OK.
  }
  const playerName =
    typeof body.playerName === "string" && body.playerName.length > 0
      ? body.playerName
      : "모험가";
  const autoPotionRules: AutoPotionConfig["rules"] = Array.isArray(
    body.autoPotionRules,
  )
    ? (body.autoPotionRules as AutoPotionConfig["rules"])
    : [];

  try {
    const response: CollectResponse = await db.transaction(async (tx) => {
      const uRows = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (uRows.length === 0) {
        return { ok: true, noop: true, reason: "no_user" };
      }
      const u = uRows[0];

      if (!u.huntActive || !u.huntBaselineAt) {
        // 이미 수령했고 결과가 남아있으면 replay (응답 손실 후 재클릭 안전).
        if (u.lastClaimResult) {
          const cached = u.lastClaimResult as OfflineSimResult;
          return {
            ok: true,
            replayed: true,
            hadReward: hasMeaningfulResult(cached),
            result: cached,
            died: cached.died,
            simMs: cached.simulatedMs,
          };
        }
        return { ok: true, noop: true, reason: "inactive" };
      }

      const baselineMs = u.huntBaselineAt.getTime();
      const now = new Date();
      const elapsedMs = now.getTime() - baselineMs;
      const simMs = Math.min(Math.max(0, elapsedMs), AUTO_HUNT_DURATION_MS);
      if (simMs < AUTO_HUNT_MIN_COLLECT_MS) {
        return { ok: true, noop: true, reason: "too_soon" };
      }

      const state = await loadStateForSim(tx, userId);
      if (!state) {
        return { ok: true, noop: true, reason: "no_state" };
      }

      const baselineHp = u.huntBaselineHp ?? state.character.hp ?? 0;
      const baselineRegionId = (u.huntRegion ?? state.map.currentRegionId) as
        | RegionId
        | undefined;
      if (!baselineRegionId) {
        // 비정상 상태 — 위탁만 해제하고 noop.
        await updateBaseline(tx, userId, {
          huntActive: false,
          huntRegion: null,
          huntBaselineHp: null,
          huntBaselineAt: null,
        });
        return { ok: true, noop: true, reason: "no_region" };
      }

      const rng = makeRng(userId, baselineMs);
      const input = assembleSimInput({
        state,
        baselineHp,
        baselineRegionId,
        awayMs: simMs,
        rng,
        // 디바이스 자동 포션 룰 — 라이브 사냥과 동일하게 위탁 sim 도 룰대로 회복.
        // 보유량 0 인 포션은 sim 이 알아서 공격으로 폴백. 결정성: 같은 룰+seed → 같은 결과,
        // collect 후엔 lastClaimResult 로 replay 하므로 룰 변경해도 무해.
        autoPotionRules,
        playerName,
      });
      const raw = simulateOfflineHunt(input);
      // 같은 rng 스트림을 이어받아 효율 후처리 — replay 시에도 동일.
      const result = applyAutoHuntEfficiency(raw, AUTO_HUNT_EFFICIENCY, rng);

      await applyResultToSaves(tx, userId, {
        state,
        result,
        died: result.died,
        baselineHp,
      });

      // 위탁 종료 — baseline NULL, 결과 캐시.
      await updateBaseline(tx, userId, {
        huntActive: false,
        huntRegion: null,
        huntBaselineHp: null,
        huntBaselineAt: null,
        lastClaimId: "collected",
        lastClaimResult: result,
      });

      return {
        ok: true,
        hadReward: hasMeaningfulResult(result),
        result,
        died: result.died,
        simMs,
      };
    });
    return Response.json(response);
  } catch (e) {
    console.error("[hunt.collect]", e);
    return new Response("internal error", { status: 500 });
  }
}
