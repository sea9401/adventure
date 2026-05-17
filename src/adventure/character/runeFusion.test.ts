import { describe, expect, it } from "vitest";
import {
  fusionCostFor,
  isFusionError,
  planRuneFusion,
  STARLIT_FUSION_RUNE_COST,
  STARLIT_FUSION_SHARD_COST,
} from "./runeFusion";

describe("fusionCostFor — 등급별 차등 비용", () => {
  it("1→2: 3, 2→3: 4, 3→4: 5, 4→5: 6", () => {
    expect(fusionCostFor(1)).toBe(3);
    expect(fusionCostFor(2)).toBe(4);
    expect(fusionCostFor(3)).toBe(5);
    expect(fusionCostFor(4)).toBe(6);
  });
});

describe("planRuneFusion", () => {
  it("1→2 — 3개 미만이면 insufficient", () => {
    const r = planRuneFusion("rune_attack", 1, 2);
    expect(r).toBe("insufficient");
    expect(isFusionError(r)).toBe(true);
  });

  it("6등급은 max_grade", () => {
    const r = planRuneFusion("rune_attack", 6, 10);
    expect(r).toBe("max_grade");
  });

  it("1→2 — 3개 정확하면 변환 가능, consumed=3", () => {
    const r = planRuneFusion("rune_attack", 1, 3);
    expect(isFusionError(r)).toBe(false);
    if (!isFusionError(r)) {
      expect(r.fromGrade).toBe(1);
      expect(r.toGrade).toBe(2);
      expect(r.consumed).toBe(3);
      expect(r.produced).toBe(1);
    }
  });

  it("2→3 — 4개 필요. 3개로는 insufficient", () => {
    expect(planRuneFusion("rune_attack", 2, 3)).toBe("insufficient");
    const r = planRuneFusion("rune_attack", 2, 4);
    expect(isFusionError(r)).toBe(false);
    if (!isFusionError(r)) {
      expect(r.toGrade).toBe(3);
      expect(r.consumed).toBe(4);
    }
  });

  it("3→4 — 5개 필요. 4개로는 insufficient", () => {
    expect(planRuneFusion("rune_attack", 3, 4)).toBe("insufficient");
    const r = planRuneFusion("rune_attack", 3, 5);
    expect(isFusionError(r)).toBe(false);
    if (!isFusionError(r)) {
      expect(r.toGrade).toBe(4);
      expect(r.consumed).toBe(5);
    }
  });

  it("4→5 — 6개 필요. 5개로는 insufficient", () => {
    expect(planRuneFusion("rune_crit", 4, 5)).toBe("insufficient");
    const r = planRuneFusion("rune_crit", 4, 6);
    expect(isFusionError(r)).toBe(false);
    if (!isFusionError(r)) {
      expect(r.toGrade).toBe(5);
      expect(r.consumed).toBe(6);
    }
    expect(planRuneFusion("rune_crit", 6, 6)).toBe("max_grade");
  });

  // 5막 PR-D1 — 5 → 6 흡수 강화. 5등급 ×1 + 별빛 조각 ×20 → 6등급 ×1.
  it("5→6 가능 — 5등급 1개 + 별빛 조각 20개", () => {
    const r = planRuneFusion("rune_attack", 5, 1, 20);
    expect(isFusionError(r)).toBe(false);
    if (!isFusionError(r)) {
      expect(r.fromGrade).toBe(5);
      expect(r.toGrade).toBe(6);
      expect(r.consumed).toBe(STARLIT_FUSION_RUNE_COST);
      expect(r.produced).toBe(1);
      expect(r.extraMaterial?.id).toBe("starfall_shard");
      expect(r.extraMaterial?.count).toBe(STARLIT_FUSION_SHARD_COST);
    }
  });

  it("5→6 — 5등급 부족 시 insufficient", () => {
    expect(planRuneFusion("rune_attack", 5, 0, 20)).toBe("insufficient");
  });

  it("5→6 — 별빛 조각 부족 시 insufficient_shard", () => {
    expect(planRuneFusion("rune_attack", 5, 1, 19)).toBe("insufficient_shard");
    expect(planRuneFusion("rune_attack", 5, 1, 0)).toBe("insufficient_shard");
  });

  it("1~4 → +1 은 shardCount 무시 (별빛 조각 비용 없음)", () => {
    const r = planRuneFusion("rune_attack", 3, 5, 0);
    expect(isFusionError(r)).toBe(false);
    if (!isFusionError(r)) {
      expect(r.toGrade).toBe(4);
      expect(r.extraMaterial).toBeUndefined();
    }
  });
});
