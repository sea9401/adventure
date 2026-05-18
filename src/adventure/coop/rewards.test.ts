import { describe, expect, it } from "vitest";
import { computeCoopReward } from "./rewards";

describe("computeCoopReward — 5막 잔영 협동 보상", () => {
  it("미등록 보스 → 빈 보상", () => {
    const r = computeCoopReward("없는보스", "legend");
    expect(r.materials).toEqual({});
    expect(r.recipes).toEqual([]);
    expect(r.titleId).toBeUndefined();
  });

  it("별빛 거인 잔영 — bronze 도달 시 giant_scale 만", () => {
    const r = computeCoopReward("별빛 거인 잔영", "bronze");
    expect(r.materials).toEqual({ giant_scale: 2 });
    expect(r.titleId).toBeUndefined();
  });

  it("별빛 거인 잔영 — gold 누적 시 giant_scale + 별빛 조각", () => {
    const r = computeCoopReward("별빛 거인 잔영", "gold");
    // bronze(2) + gold(2) = giant_scale 4 / silver(4) + gold(6) = starfall_shard 10
    expect(r.materials).toEqual({ giant_scale: 4, starfall_shard: 10 });
    expect(r.titleId).toBeUndefined(); // 칭호는 legend 한정
  });

  it("별빛 거인 잔영 — legend 도달 시 칭호 + unique 굴림 (1%)", () => {
    const r = computeCoopReward("별빛 거인 잔영", "legend");
    // 누적: giant_scale 4 + starfall_shard 18 (4+6+8)
    expect(r.materials.giant_scale).toBe(4);
    expect(r.materials.starfall_shard).toBe(18);
    expect(r.titleId).toBe("starlit_giant_breaker");
    expect(r.equipRolls).toEqual([{ itemId: "giant_yoke", chance: 0.01 }]);
  });

  it("수심의 메아리 — legend 시 deep_scale + 별빛 조각 + 수심의 메아리 보주 1%", () => {
    const r = computeCoopReward("수심의 메아리", "legend");
    expect(r.materials.deep_scale).toBe(4);
    expect(r.materials.starfall_shard).toBe(18);
    expect(r.titleId).toBe("starlit_depth_breaker");
    expect(r.equipRolls).toEqual([{ itemId: "deep_orb", chance: 0.01 }]);
  });

  it("성문지기 잔영 — legend 시 war_banner_scrap + 별빛 조각 + 성문의 빗장 1%", () => {
    const r = computeCoopReward("성문지기 잔영", "legend");
    expect(r.materials.war_banner_scrap).toBe(4);
    expect(r.materials.starfall_shard).toBe(18);
    expect(r.titleId).toBe("starlit_gate_breaker");
    expect(r.equipRolls).toEqual([{ itemId: "gate_bar", chance: 0.01 }]);
  });

  // 잔영 협동 보상에 recipeOneOf 가 없다 — Ch 30 종착 의식에서 별빛 재단법은 이미 자동
  // 학습돼 있으므로 중복 학습 시도가 의미 없기 때문. 기존 보스들과 다른 결.
  it("잔영 협동 — recipeOneOf 없음 (재단법은 Ch 30 에서 자동 학습)", () => {
    for (const boss of ["별빛 거인 잔영", "수심의 메아리", "성문지기 잔영"] as const) {
      const r = computeCoopReward(boss, "gold");
      expect(r.recipeOneOf).toBeUndefined();
      expect(r.recipes).toEqual([]);
    }
  });
});
