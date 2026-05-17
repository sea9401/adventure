import { describe, it, expect } from "vitest";
import { tierFor, tierProgress } from "./tiers";

describe("tierFor — Elo → 티어 매핑", () => {
  it("0 → 브론즈", () => {
    expect(tierFor(0).key).toBe("bronze");
    expect(tierFor(999).key).toBe("bronze");
  });

  it("1000 (ELO_INITIAL) → 실버", () => {
    expect(tierFor(1000).key).toBe("silver");
  });

  it("티어 경계는 inclusive — 1200/1400/1600/1800", () => {
    expect(tierFor(1199).key).toBe("silver");
    expect(tierFor(1200).key).toBe("gold");
    expect(tierFor(1399).key).toBe("gold");
    expect(tierFor(1400).key).toBe("platinum");
    expect(tierFor(1599).key).toBe("platinum");
    expect(tierFor(1600).key).toBe("diamond");
    expect(tierFor(1799).key).toBe("diamond");
    expect(tierFor(1800).key).toBe("master");
    expect(tierFor(9999).key).toBe("master");
  });
});

describe("tierProgress — 티어 내 진행도", () => {
  it("티어 시작점은 0", () => {
    expect(tierProgress(1000)).toBe(0);
    expect(tierProgress(1200)).toBe(0);
  });

  it("티어 중간은 0.5", () => {
    expect(tierProgress(1100)).toBeCloseTo(0.5);
    expect(tierProgress(1300)).toBeCloseTo(0.5);
  });

  it("Master 는 항상 1", () => {
    expect(tierProgress(1800)).toBe(1);
    expect(tierProgress(5000)).toBe(1);
  });

  it("브론즈 (Elo 0 시작) — 절반은 500", () => {
    expect(tierProgress(500)).toBeCloseTo(0.5);
  });
});
