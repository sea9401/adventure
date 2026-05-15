import { describe, expect, it } from "vitest";
import {
  kstWeekStartKey,
  lastWeekStartKey,
  updateTowerWeekly,
} from "./weeklyTypes";

describe("kstWeekStartKey", () => {
  it("KST 월요일 00:00 직후 = 그 월요일", () => {
    const t = new Date("2026-05-10T15:01:00Z");
    expect(kstWeekStartKey(t)).toBe("2026-05-11");
  });

  it("KST 일요일 23:59 = 그 주 월요일", () => {
    const t = new Date("2026-05-17T14:59:00Z");
    expect(kstWeekStartKey(t)).toBe("2026-05-11");
  });

  it("KST 월요일 00:00 정각 = 그 월요일", () => {
    const t = new Date("2026-05-10T15:00:00Z");
    expect(kstWeekStartKey(t)).toBe("2026-05-11");
  });
});

describe("lastWeekStartKey", () => {
  it("KST 화요일 → 지난 월요일", () => {
    const t = new Date("2026-05-11T15:01:00Z");
    expect(kstWeekStartKey(t)).toBe("2026-05-11");
    expect(lastWeekStartKey(t)).toBe("2026-05-04");
  });
});

describe("updateTowerWeekly", () => {
  const now = new Date("2026-05-13T03:00:00Z");
  const thisWeek = kstWeekStartKey(now);

  it("prev 없음 + floor 50 → 신규 50", () => {
    const r = updateTowerWeekly(null, 50, now);
    expect(r).toEqual({ weekHighest: 50, weekStartedAt: thisWeek });
  });

  it("prev 가 이전 주 + floor 5 → 리셋 후 5", () => {
    const prev = { weekHighest: 100, weekStartedAt: "2026-05-04" };
    const r = updateTowerWeekly(prev, 5, now);
    expect(r).toEqual({ weekHighest: 5, weekStartedAt: thisWeek });
  });

  it("prev 가 이번 주 + 더 낮은 floor → null (변경 없음)", () => {
    const prev = { weekHighest: 80, weekStartedAt: thisWeek };
    expect(updateTowerWeekly(prev, 50, now)).toBeNull();
  });

  it("prev 가 이번 주 + 더 높은 floor → 갱신", () => {
    const prev = { weekHighest: 50, weekStartedAt: thisWeek };
    const r = updateTowerWeekly(prev, 80, now);
    expect(r).toEqual({ weekHighest: 80, weekStartedAt: thisWeek });
  });

  it("동률은 변경 없음 (null)", () => {
    const prev = { weekHighest: 50, weekStartedAt: thisWeek };
    expect(updateTowerWeekly(prev, 50, now)).toBeNull();
  });
});
