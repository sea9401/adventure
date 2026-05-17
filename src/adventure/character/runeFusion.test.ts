import { describe, expect, it } from "vitest";
import {
  isFusionError,
  planRuneFusion,
  RUNE_FUSION_COST,
  STARLIT_FUSION_RUNE_COST,
  STARLIT_FUSION_SHARD_COST,
} from "./runeFusion";

describe("planRuneFusion", () => {
  it("3개 미만이면 insufficient", () => {
    const r = planRuneFusion("rune_attack", 1, 2);
    expect(r).toBe("insufficient");
    expect(isFusionError(r)).toBe(true);
  });

  it("6등급은 max_grade", () => {
    const r = planRuneFusion("rune_attack", 6, 10);
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

  it("4→5 가능, 6→? 불가", () => {
    const ok = planRuneFusion("rune_crit", 4, 3);
    expect(isFusionError(ok)).toBe(false);
    if (!isFusionError(ok)) expect(ok.toGrade).toBe(5);
    expect(planRuneFusion("rune_crit", 6, 3)).toBe("max_grade");
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
