import { describe, it, expect } from "vitest";
import {
  applyExpGain,
  getLevelTable,
  MAX_LEVEL,
  requiredExpToNext,
} from "./leveling";

describe("requiredExpToNext", () => {
  it("Lv1→2는 120", () => {
    expect(requiredExpToNext(1)).toBe(120);
  });

  it("레벨이 오르면 단조 증가", () => {
    for (let lv = 1; lv < MAX_LEVEL - 1; lv += 1) {
      expect(requiredExpToNext(lv)!).toBeLessThanOrEqual(
        requiredExpToNext(lv + 1)!,
      );
    }
  });

  it("만렙은 null", () => {
    expect(requiredExpToNext(MAX_LEVEL)).toBeNull();
  });

  it("0 이하는 null", () => {
    expect(requiredExpToNext(0)).toBeNull();
    expect(requiredExpToNext(-1)).toBeNull();
  });

  it("엔드게임 multiplier 구간 경계 — Lv60 ×1.00 / Lv70 ×1.30 / Lv90 ×1.55 + 35+ 완화 ×0.85", () => {
    // 50 이상은 reduction floor 0.85 풀반영. endgame multiplier 가 그 위에 곱해진다.
    const base = (lv: number) => (120 / 35) * Math.pow(lv, 2.5);
    expect(requiredExpToNext(60)).toBe(Math.floor(base(60) * 1.0 * 0.85));
    expect(requiredExpToNext(70)).toBe(Math.floor(base(70) * 1.3 * 0.85));
    expect(requiredExpToNext(90)).toBe(Math.floor(base(90) * 1.55 * 0.85));
  });

  it("35~49 reduction 램프 — 35 ×1.00 / 50 ×0.85 / 사이 선형", () => {
    const base = (lv: number) => (120 / 35) * Math.pow(lv, 2.5);
    // 35 경계는 reduction 1.0 — 35^1.5 기준 lower 곡선과 자연 연속.
    expect(requiredExpToNext(35)).toBe(Math.floor(base(35) * 1.0));
    // 50 부터 floor 0.85 도달.
    expect(requiredExpToNext(50)).toBe(Math.floor(base(50) * 0.85));
    // 중간 — 1.00 → 0.85 선형. lv42 (절반) 시 ~0.925.
    const mult42 = 1 - 0.15 * ((42 - 35) / 15);
    expect(requiredExpToNext(42)).toBe(Math.floor(base(42) * mult42));
  });
});

describe("MAX_LEVEL", () => {
  it("만렙은 100", () => {
    expect(MAX_LEVEL).toBe(100);
  });
});

describe("applyExpGain", () => {
  it("임계치 미달이면 EXP만 누적", () => {
    const r = applyExpGain(1, 30, 50);
    expect(r).toEqual({ level: 1, exp: 80, levelsGained: 0, overflowExp: 0 });
  });

  it("임계치 정확히 도달하면 1 레벨업, 잉여 0", () => {
    const r = applyExpGain(1, 0, 120);
    expect(r).toEqual({ level: 2, exp: 0, levelsGained: 1, overflowExp: 0 });
  });

  it("한 번에 여러 레벨도 처리", () => {
    // Lv1 need = 120, Lv2 need = floor(120 * 2^1.5) = 339 → 합산 459
    const r = applyExpGain(1, 0, 500);
    expect(r.level).toBe(3);
    expect(r.levelsGained).toBe(2);
    expect(r.exp).toBe(500 - 120 - 339);
    expect(r.overflowExp).toBe(0);
  });

  it("만렙 도달 시 잉여 EXP는 overflowExp 로 분리, exp 는 0으로 캡", () => {
    const r = applyExpGain(MAX_LEVEL, 0, 999_999);
    expect(r.level).toBe(MAX_LEVEL);
    expect(r.exp).toBe(0);
    expect(r.overflowExp).toBe(999_999);
  });

  it("만렙 도달하는 호출은 잔여 EXP 가 overflow 로", () => {
    // Lv 99 에서 99→100 비용을 5000 초과로 받으면 5000 이 overflow.
    const need99 = requiredExpToNext(99)!;
    const r = applyExpGain(99, 0, need99 + 5000);
    expect(r.level).toBe(MAX_LEVEL);
    expect(r.exp).toBe(0);
    expect(r.overflowExp).toBe(5000);
  });

  it("음수 gain은 0으로 클램프", () => {
    const r = applyExpGain(2, 50, -100);
    expect(r).toEqual({ level: 2, exp: 0, levelsGained: 0, overflowExp: 0 });
  });
});

describe("getLevelTable", () => {
  it("MAX_LEVEL - 1 줄을 반환하고 누적은 단조 증가", () => {
    const rows = getLevelTable();
    expect(rows.length).toBe(MAX_LEVEL - 1);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].cumulative).toBeGreaterThan(rows[i - 1].cumulative);
    }
  });
});
