// decideClaim / decideWinner 의 분기 검증.
// collect 라우트의 두 tx 분리 — 동시 collect 시 winner 결정의 핵심 로직만 순수 함수로 빼서
// 테스트한다. DB I/O 통합 테스트 인프라가 없어 라우트 자체는 수동 시나리오로 검증.

import { describe, expect, it } from "vitest";
import { decideClaim, decideWinner, type ClaimSnapshot } from "./autoHunt";
import type { OfflineSimResult } from "@/adventure/battle/offlineSim";

const MIN_MS = 10_000;

function makeResult(overrides: Partial<OfflineSimResult> = {}): OfflineSimResult {
  return {
    simulatedMs: 60 * 60 * 1000,
    cappedByLimit: false,
    battles: 5,
    wins: 5,
    killsByName: {},
    expGained: 0,
    expBonusApplied: false,
    goldGained: 0,
    materialsGained: {},
    equipsGained: [],
    recipesLearned: [],
    potionsConsumed: {},
    finalPlayerHp: 100,
    died: false,
    ...overrides,
  };
}

function snap(over: Partial<ClaimSnapshot> = {}): ClaimSnapshot {
  return {
    huntActive: false,
    huntBaselineAt: null,
    huntBaselineHp: null,
    huntRegion: null,
    lastClaimResult: null,
    ...over,
  };
}

describe("decideClaim", () => {
  it("user 없음 → no_user", () => {
    expect(decideClaim(null, 1_000_000, MIN_MS)).toEqual({
      kind: "noop",
      reason: "no_user",
    });
  });

  it("huntActive=false + lastClaimResult 있음 → replay (lost-response 재시도 안전)", () => {
    const result = makeResult();
    const d = decideClaim(snap({ lastClaimResult: result }), 1_000_000, MIN_MS);
    expect(d).toEqual({ kind: "replay", result });
  });

  it("huntActive=false + 결과도 없음 → inactive noop", () => {
    expect(decideClaim(snap(), 1_000_000, MIN_MS)).toEqual({
      kind: "noop",
      reason: "inactive",
    });
  });

  it("MIN_COLLECT_MS 미만 → too_soon", () => {
    const baselineAt = new Date(1_000_000);
    const now = baselineAt.getTime() + MIN_MS - 1;
    const d = decideClaim(
      snap({ huntActive: true, huntBaselineAt: baselineAt, huntRegion: "plains" }),
      now,
      MIN_MS,
    );
    expect(d).toEqual({ kind: "noop", reason: "too_soon" });
  });

  it("region 없음 → clear_baseline (위탁만 정리)", () => {
    const baselineAt = new Date(1_000_000);
    const d = decideClaim(
      snap({ huntActive: true, huntBaselineAt: baselineAt, huntRegion: null }),
      baselineAt.getTime() + MIN_MS,
      MIN_MS,
    );
    expect(d).toEqual({ kind: "clear_baseline", reason: "no_region" });
  });

  it("정상 ready — baselineMs/HP/region 패스스루", () => {
    const baselineAt = new Date(1_000_000);
    const d = decideClaim(
      snap({
        huntActive: true,
        huntBaselineAt: baselineAt,
        huntBaselineHp: 77,
        huntRegion: "plains",
      }),
      baselineAt.getTime() + MIN_MS + 1,
      MIN_MS,
    );
    expect(d).toEqual({
      kind: "ready",
      baselineMs: baselineAt.getTime(),
      baselineHp: 77,
      regionId: "plains",
    });
  });
});

describe("decideWinner", () => {
  const baselineMs = 2_000_000;
  const baselineAt = new Date(baselineMs);

  it("같은 baseline + 여전히 active → winner", () => {
    const u = snap({ huntActive: true, huntBaselineAt: baselineAt });
    expect(decideWinner(u, baselineMs)).toEqual({ kind: "winner" });
  });

  it("이미 비활성화 + lastClaimResult 있음 → replay (다른 collect 가 먼저 적용)", () => {
    const result = makeResult();
    const u = snap({
      huntActive: false,
      huntBaselineAt: null,
      lastClaimResult: result,
    });
    expect(decideWinner(u, baselineMs)).toEqual({ kind: "replay", result });
  });

  it("baseline 시각이 다름 → lost (새 dispatch 가 끼어듦)", () => {
    // 다른 collect 가 끝낸 뒤 곧장 새 dispatch — huntActive=true, 하지만 baselineMs 다름.
    const u = snap({
      huntActive: true,
      huntBaselineAt: new Date(baselineMs + 60_000),
      lastClaimResult: null,
    });
    expect(decideWinner(u, baselineMs)).toEqual({ kind: "lost" });
  });

  it("비활성화 + 결과 없음 → lost (이론상 드물지만 안전망)", () => {
    const u = snap({ huntActive: false, huntBaselineAt: null });
    expect(decideWinner(u, baselineMs)).toEqual({ kind: "lost" });
  });
});
