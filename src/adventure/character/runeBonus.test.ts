import { describe, expect, it } from "vitest";
import { computeRuneBonus, pctToMultiplier } from "./runeBonus";

describe("computeRuneBonus", () => {
  it("undefined / 빈 슬롯 → 모두 0", () => {
    expect(computeRuneBonus(undefined).atk_pct).toBe(0);
    expect(computeRuneBonus([null, null, null]).hp_pct).toBe(0);
  });

  it("ATK 5등급 1슬롯 = +10%", () => {
    const b = computeRuneBonus([{ id: "rune_attack", grade: 5 }, null, null]);
    expect(b.atk_pct).toBe(10);
    expect(b.def_pct).toBe(0);
  });

  it("같은 효과 종 룬은 합산 — ATK 5등급 ×3 = +30%", () => {
    const b = computeRuneBonus([
      { id: "rune_attack", grade: 5 },
      { id: "rune_attack", grade: 5 },
      { id: "rune_attack", grade: 5 },
    ]);
    expect(b.atk_pct).toBe(30);
  });

  it("혼합 빌드 — ATK 4등급 + 행운 3등급 + 치명타 5등급", () => {
    const b = computeRuneBonus([
      { id: "rune_attack", grade: 4 },
      { id: "rune_fortune", grade: 3 },
      { id: "rune_crit", grade: 5 },
    ]);
    expect(b.atk_pct).toBe(8);
    expect(b.drop_pct).toBe(15);
    expect(b.crit_pct).toBe(10);
    expect(b.def_pct).toBe(0);
  });

  it("자원형 5등급은 30% (평탄과 다른 magnitude)", () => {
    const b = computeRuneBonus([
      { id: "rune_training", grade: 5 },
      null,
      null,
    ]);
    expect(b.exp_pct).toBe(30);
  });

  it("proc 룬 5등급 — 반격/흡혈 15%", () => {
    const b = computeRuneBonus([
      { id: "rune_counter", grade: 5 },
      { id: "rune_lifesteal", grade: 5 },
      null,
    ]);
    expect(b.counter_pct).toBe(15);
    expect(b.lifesteal_pct).toBe(15);
  });

  it("재생 룬 5등급 = 5%", () => {
    const b = computeRuneBonus([
      { id: "rune_regen", grade: 5 },
      null,
      null,
    ]);
    expect(b.regen_pct).toBe(5);
  });

  it("같은 proc 룬 5등급 ×3 = 45% (cap 없음 — 호출부 책임)", () => {
    const b = computeRuneBonus([
      { id: "rune_counter", grade: 5 },
      { id: "rune_counter", grade: 5 },
      { id: "rune_counter", grade: 5 },
    ]);
    expect(b.counter_pct).toBe(45);
  });
});

describe("pctToMultiplier", () => {
  it("0 → 1, 50 → 1.5, 100 → 2", () => {
    expect(pctToMultiplier(0)).toBe(1);
    expect(pctToMultiplier(50)).toBe(1.5);
    expect(pctToMultiplier(100)).toBe(2);
  });
});
