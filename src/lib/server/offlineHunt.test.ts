// offlineHunt 서버 lib 의 결정성 검증 — claim 멱등성과 응답 손실 후 재시도 안전성의 핵심.
//
// DB 와 닿는 applyResultToSaves / updateBaseline 등은 통합 테스트 인프라가 없어 제외.
// 수동 시나리오 (npm run dev + Network 탭) 로 검증.

import { describe, expect, it } from "vitest";
import { makeRng } from "./offlineHunt";

describe("makeRng", () => {
  it("같은 userId + baseline 이면 결정적으로 같은 시퀀스", () => {
    const a = makeRng("user-abc", 1_700_000_000_000);
    const b = makeRng("user-abc", 1_700_000_000_000);
    for (let i = 0; i < 100; i += 1) {
      expect(a()).toBe(b());
    }
  });

  it("다른 baseline 이면 다른 시퀀스", () => {
    const a = makeRng("user-abc", 1_700_000_000_000);
    const b = makeRng("user-abc", 1_700_000_000_001);
    // 첫 10개 중 하나라도 다르면 충분 — 같을 확률 ~ 2^-320 이라 사실상 0.
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("다른 userId 면 다른 시퀀스", () => {
    const a = makeRng("user-A", 1_700_000_000_000);
    const b = makeRng("user-B", 1_700_000_000_000);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("출력값은 [0, 1) 범위", () => {
    const rng = makeRng("u", 1);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
