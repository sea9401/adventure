import { describe, expect, it } from "vitest";
import { seasonIdFor, weekStartUtcFor, weekEndUtcFor } from "./season";

// 시즌 경계 = 월요일 00:00 KST = 일요일 15:00 UTC.

describe("weekStartUtcFor — 경계 케이스", () => {
  it("월요일 KST 자정 직후 → 그 자정", () => {
    // 2026-05-18 (월) 00:00 KST = 2026-05-17 15:00 UTC.
    const now = new Date("2026-05-18T00:30:00+09:00");
    const start = weekStartUtcFor(now);
    expect(start.toISOString()).toBe("2026-05-17T15:00:00.000Z");
  });
  it("화요일 KST 정오 → 같은 주 월요일", () => {
    const now = new Date("2026-05-19T12:00:00+09:00");
    const start = weekStartUtcFor(now);
    expect(start.toISOString()).toBe("2026-05-17T15:00:00.000Z");
  });
  it("일요일 KST 23:00 (월요일 KST 00:00 직전) → 직전 주 월요일", () => {
    const now = new Date("2026-05-17T23:00:00+09:00");
    const start = weekStartUtcFor(now);
    expect(start.toISOString()).toBe("2026-05-10T15:00:00.000Z");
  });
  it("월요일 KST 00:00 정각 → 그 자정 (≥ 경계)", () => {
    const now = new Date("2026-05-18T00:00:00+09:00");
    const start = weekStartUtcFor(now);
    expect(start.toISOString()).toBe("2026-05-17T15:00:00.000Z");
  });
});

describe("weekEndUtcFor — 정확히 7일 후", () => {
  it("월 00:00 KST 시작 → 다음 월 00:00 KST 끝", () => {
    const start = new Date("2026-05-17T15:00:00.000Z");
    const end = weekEndUtcFor(start);
    expect(end.toISOString()).toBe("2026-05-24T15:00:00.000Z");
  });
});

describe("seasonIdFor — ISO 주차", () => {
  it("2026-05-18 (월 KST) 시작 시즌 → 2026-W21", () => {
    const start = new Date("2026-05-17T15:00:00.000Z");
    expect(seasonIdFor(start)).toBe("2026-W21");
  });
  it("2026-01-05 (월 KST) 시작 시즌 → 2026-W02", () => {
    const start = new Date("2026-01-04T15:00:00.000Z");
    expect(seasonIdFor(start)).toBe("2026-W02");
  });
});
