import { describe, it, expect } from "vitest";
import { requiredExpToNext } from "./leveling";
import {
  addParagonExp,
  cumulativeExpForPoints,
  expToNextPoint,
  initialParagonState,
  paragonPointCost,
  pointsFromExp,
  PARAGON_EXP_CAP,
  PARAGON_TOTAL_CAP,
  PARAGON_TRACK_CAP,
  PARAGON_TRACKS,
  readInitialParagon,
  totalAllocated,
  unspentPoints,
} from "./paragon";

describe("paragonPointCost", () => {
  it("1pt 비용은 99→100 비용과 동일", () => {
    expect(paragonPointCost(1)).toBe(requiredExpToNext(99));
  });

  it("n번째 pt 비용은 ×1.15^(n-1)", () => {
    const base = requiredExpToNext(99)!;
    expect(paragonPointCost(2)).toBe(Math.floor(base * 1.15));
    expect(paragonPointCost(3)).toBe(Math.floor(base * Math.pow(1.15, 2)));
    expect(paragonPointCost(10)).toBe(Math.floor(base * Math.pow(1.15, 9)));
  });

  it("범위 밖은 0", () => {
    expect(paragonPointCost(0)).toBe(0);
    expect(paragonPointCost(-1)).toBe(0);
    expect(paragonPointCost(PARAGON_TOTAL_CAP + 1)).toBe(0);
  });
});

describe("cumulativeExpForPoints", () => {
  it("0pt 는 0", () => {
    expect(cumulativeExpForPoints(0)).toBe(0);
    expect(cumulativeExpForPoints(-1)).toBe(0);
  });

  it("1pt 누적 = 1pt 비용", () => {
    expect(cumulativeExpForPoints(1)).toBe(paragonPointCost(1));
  });

  it("누적은 단조 증가", () => {
    for (let n = 1; n < 20; n += 1) {
      expect(cumulativeExpForPoints(n + 1)).toBeGreaterThan(
        cumulativeExpForPoints(n),
      );
    }
  });

  it("캡 이상 인풋은 PARAGON_TOTAL_CAP 까지만", () => {
    const cap = cumulativeExpForPoints(PARAGON_TOTAL_CAP);
    expect(cumulativeExpForPoints(PARAGON_TOTAL_CAP + 100)).toBe(cap);
  });
});

describe("pointsFromExp", () => {
  it("0 / 음수 EXP → 0pt", () => {
    expect(pointsFromExp(0)).toBe(0);
    expect(pointsFromExp(-5)).toBe(0);
  });

  it("1pt 비용 직전엔 0pt", () => {
    const cost1 = paragonPointCost(1);
    expect(pointsFromExp(cost1 - 1)).toBe(0);
  });

  it("1pt 비용 정확히 EXP 면 1pt", () => {
    expect(pointsFromExp(paragonPointCost(1))).toBe(1);
  });

  it("3pt 누적 EXP 면 3pt", () => {
    expect(pointsFromExp(cumulativeExpForPoints(3))).toBe(3);
  });

  it("EXP 캡 이상은 PARAGON_TOTAL_CAP 까지만", () => {
    expect(pointsFromExp(PARAGON_EXP_CAP)).toBe(PARAGON_TOTAL_CAP);
    expect(pointsFromExp(PARAGON_EXP_CAP * 2)).toBe(PARAGON_TOTAL_CAP);
  });
});

describe("expToNextPoint", () => {
  it("0pt 보유 시 1pt 까지 = 1pt 비용 전부", () => {
    expect(expToNextPoint(0)).toBe(paragonPointCost(1));
  });

  it("정확히 1pt 보유 시 2pt 까지 = 2pt 비용", () => {
    expect(expToNextPoint(paragonPointCost(1))).toBe(paragonPointCost(2));
  });

  it("캡 도달 시 0", () => {
    expect(expToNextPoint(PARAGON_EXP_CAP)).toBe(0);
  });
});

describe("addParagonExp", () => {
  it("양수 gain 은 누적", () => {
    const r = addParagonExp(initialParagonState, 1000);
    expect(r.paragonExp).toBe(1000);
  });

  it("0 / 음수 gain 은 무변경 (같은 참조 반환)", () => {
    expect(addParagonExp(initialParagonState, 0)).toBe(initialParagonState);
    expect(addParagonExp(initialParagonState, -5)).toBe(initialParagonState);
  });

  it("캡 도달 후 추가는 무변경 (같은 참조)", () => {
    const capped = { paragonExp: PARAGON_EXP_CAP, allocations: {} };
    expect(addParagonExp(capped, 999_999)).toBe(capped);
  });

  it("캡 직전 + 큰 gain → 캡으로 클램프", () => {
    const near = { paragonExp: PARAGON_EXP_CAP - 100, allocations: {} };
    const r = addParagonExp(near, 999_999);
    expect(r.paragonExp).toBe(PARAGON_EXP_CAP);
  });
});

describe("totalAllocated / unspentPoints", () => {
  it("빈 상태 = 0/0", () => {
    expect(totalAllocated(initialParagonState)).toBe(0);
    expect(unspentPoints(initialParagonState)).toBe(0);
  });

  it("할당 합산", () => {
    const s = {
      paragonExp: cumulativeExpForPoints(10),
      allocations: { wrath: 3, guard: 2 } as Partial<
        Record<(typeof PARAGON_TRACKS)[number], number>
      >,
    };
    expect(totalAllocated(s)).toBe(5);
    expect(unspentPoints(s)).toBe(10 - 5);
  });

  it("할당이 보유 포인트보다 많아도 unspent 는 음수 안 됨", () => {
    const s = {
      paragonExp: 0,
      allocations: { wrath: 5 } as Partial<
        Record<(typeof PARAGON_TRACKS)[number], number>
      >,
    };
    expect(unspentPoints(s)).toBe(0);
  });
});

describe("readInitialParagon", () => {
  it("null/undefined/원시값 → 초기 상태", () => {
    expect(readInitialParagon(null)).toEqual(initialParagonState);
    expect(readInitialParagon(undefined)).toEqual(initialParagonState);
    expect(readInitialParagon(42)).toEqual(initialParagonState);
    expect(readInitialParagon("nope")).toEqual(initialParagonState);
  });

  it("유효한 값 파싱", () => {
    const r = readInitialParagon({
      paragonExp: 5000,
      allocations: { wrath: 3, blast: 7 },
    });
    expect(r.paragonExp).toBe(5000);
    expect(r.allocations).toEqual({ wrath: 3, blast: 7 });
  });

  it("EXP 음수/NaN → 0", () => {
    expect(readInitialParagon({ paragonExp: -5, allocations: {} }).paragonExp).toBe(
      0,
    );
    expect(
      readInitialParagon({ paragonExp: Number.NaN, allocations: {} })
        .paragonExp,
    ).toBe(0);
  });

  it("EXP 캡 초과 → 캡 클램프", () => {
    expect(
      readInitialParagon({
        paragonExp: PARAGON_EXP_CAP * 2,
        allocations: {},
      }).paragonExp,
    ).toBe(PARAGON_EXP_CAP);
  });

  it("트랙 할당 25 초과 → 25 로 클램프", () => {
    const r = readInitialParagon({
      paragonExp: 0,
      allocations: { wrath: 999 },
    });
    expect(r.allocations.wrath).toBe(PARAGON_TRACK_CAP);
  });

  it("음수 할당은 무시", () => {
    const r = readInitialParagon({
      paragonExp: 0,
      allocations: { wrath: -3, guard: 5 },
    });
    expect(r.allocations.wrath).toBeUndefined();
    expect(r.allocations.guard).toBe(5);
  });

  it("알 수 없는 트랙 키 무시", () => {
    const r = readInitialParagon({
      paragonExp: 0,
      allocations: { wrath: 2, bogus: 99 },
    });
    expect(r.allocations.wrath).toBe(2);
    expect((r.allocations as Record<string, number>).bogus).toBeUndefined();
  });
});
