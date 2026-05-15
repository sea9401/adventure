import { describe, expect, it } from "vitest";
import { isFusionError, planRuneFusion, RUNE_FUSION_COST } from "./runeFusion";

describe("planRuneFusion", () => {
  it("3개 미만이면 insufficient", () => {
    const r = planRuneFusion("rune_attack", 1, 2);
    expect(r).toBe("insufficient");
    expect(isFusionError(r)).toBe(true);
  });

  it("5등급은 max_grade", () => {
    const r = planRuneFusion("rune_attack", 5, 10);
    expect(r).toBe("max_grade");
  });

  it("3개 정확하면 1→2 변환 가능", () => {
    const r = planRuneFusion("rune_attack", 1, 3);
    expect(isFusionError(r)).toBe(false);
    if (!isFusionError(r)) {
      expect(r.fromGrade).toBe(1);
      expect(r.toGrade).toBe(2);
      expect(r.consumed).toBe(RUNE_FUSION_COST);
      expect(r.produced).toBe(1);
    }
  });

  it("4→5 가능, 5→? 불가", () => {
    const ok = planRuneFusion("rune_crit", 4, 3);
    expect(isFusionError(ok)).toBe(false);
    if (!isFusionError(ok)) expect(ok.toGrade).toBe(5);
    expect(planRuneFusion("rune_crit", 5, 3)).toBe("max_grade");
  });
});
