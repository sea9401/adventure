import { describe, expect, it } from "vitest";
import {
  ELO_INITIAL,
  ELO_K,
  applyEloMatch,
  computeNewRating,
} from "./elo";

describe("computeNewRating — 단일 쪽", () => {
  it("동일 레이팅 승 → +K/2 (=16)", () => {
    // expected=0.5, K(1-0.5)=16
    expect(computeNewRating(1000, 1000, "win")).toBe(1016);
  });
  it("동일 레이팅 패 → -K/2 (=-16)", () => {
    expect(computeNewRating(1000, 1000, "loss")).toBe(984);
  });
  it("동일 레이팅 무 → 변동 없음", () => {
    expect(computeNewRating(1000, 1000, "draw")).toBe(1000);
  });
  it("강자가 약자 잡으면 적게 오름", () => {
    // 1400 vs 1000 — expected ≈ 0.909, K(1-0.909)≈2.9
    expect(computeNewRating(1400, 1000, "win")).toBe(1403);
  });
  it("약자가 강자 잡으면 많이 오름 (업셋)", () => {
    expect(computeNewRating(1000, 1400, "win")).toBe(1029);
  });
  it("강자가 약자에 짐 → 크게 깎임", () => {
    expect(computeNewRating(1400, 1000, "loss")).toBe(1371);
  });
  it("0 미만으로 안 떨어짐 (floor)", () => {
    // rating 0 에서 무한 강자에게 또 짐 → 변동 -K, max(0, -16)=0
    expect(computeNewRating(0, 5000, "loss")).toBe(0);
  });
});

describe("applyEloMatch — 양쪽 동시 (zero-sum)", () => {
  it("a_win: 양쪽 변동 합 = 0", () => {
    const r = applyEloMatch(1000, 1000, "a_win");
    expect(r.attackerAfter).toBe(1016);
    expect(r.defenderAfter).toBe(984);
    expect(r.attackerAfter - 1000 + (r.defenderAfter - 1000)).toBe(0);
  });
  it("d_win: 대칭", () => {
    const r = applyEloMatch(1000, 1000, "d_win");
    expect(r.attackerAfter).toBe(984);
    expect(r.defenderAfter).toBe(1016);
  });
  it("draw: 둘 다 그대로 (동일 레이팅 한정)", () => {
    const r = applyEloMatch(1000, 1000, "draw");
    expect(r.attackerAfter).toBe(1000);
    expect(r.defenderAfter).toBe(1000);
  });
  it("draw with 강자 vs 약자: 강자 살짝 깎이고 약자 살짝 오름", () => {
    const r = applyEloMatch(1400, 1000, "draw");
    // expected_a = 0.909, score=0.5 → delta = K*(0.5-0.909) ≈ -13
    expect(r.attackerAfter).toBeLessThan(1400);
    expect(r.defenderAfter).toBeGreaterThan(1000);
    // zero-sum (round 오차 ±1 허용)
    const total = r.attackerAfter - 1400 + (r.defenderAfter - 1000);
    expect(Math.abs(total)).toBeLessThanOrEqual(1);
  });
});

describe("상수", () => {
  it("ELO_K=32", () => expect(ELO_K).toBe(32));
  it("ELO_INITIAL=1000", () => expect(ELO_INITIAL).toBe(1000));
});
