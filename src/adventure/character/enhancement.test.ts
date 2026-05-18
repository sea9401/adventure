import { describe, expect, it } from "vitest";
import {
  ENHANCE_FULL_COST,
  ENHANCE_MAX_LEVEL,
  ENHANCE_SHARD_COST,
  enhancementBonus,
  isEnhanceable,
  nextEnhanceCost,
  planEnhance,
  resolveEnhancedItem,
} from "./enhancement";

describe("enhancement — 비용 상수", () => {
  it("ENHANCE_SHARD_COST 의 합이 ENHANCE_FULL_COST 와 같다", () => {
    const sum = ENHANCE_SHARD_COST.reduce((a, b) => a + b, 0);
    expect(sum).toBe(ENHANCE_FULL_COST);
    expect(ENHANCE_FULL_COST).toBe(590); // 30+60+100+150+250
  });

  it("ENHANCE_MAX_LEVEL 까지 모든 단계에 비용 entry 가 있다 (0 단계는 0)", () => {
    expect(ENHANCE_SHARD_COST.length).toBe(ENHANCE_MAX_LEVEL + 1);
    expect(ENHANCE_SHARD_COST[0]).toBe(0);
  });
});

describe("enhancement — isEnhaceable", () => {
  it("별빛 재단 무구 5종만 강화 가능", () => {
    for (const id of [
      "starlit_blade",
      "starlit_aegis",
      "starlit_lance",
      "starlit_grip",
      "starlit_mantle",
    ] as const) {
      expect(isEnhanceable(id)).toBe(true);
    }
  });

  it("empyrean 이하 는 강화 불가", () => {
    for (const id of [
      "empyrean_blade",
      "star_blade",
      "peak_sword",
      "baseball_bat",
    ] as const) {
      expect(isEnhanceable(id)).toBe(false);
    }
  });
});

describe("enhancement — enhancementBonus", () => {
  it("0 단계는 빈 보너스", () => {
    expect(enhancementBonus("starlit_blade", 0)).toEqual({});
  });

  it("무기: 단계당 atk +1 + 주능력치 +1", () => {
    expect(enhancementBonus("starlit_blade", 3)).toEqual({ atk: 3, str: 3 });
    expect(enhancementBonus("starlit_aegis", 5)).toEqual({ atk: 5, vit: 5 });
    expect(enhancementBonus("starlit_lance", 2)).toEqual({ atk: 2, dex: 2 });
    expect(enhancementBonus("starlit_grip", 4)).toEqual({ atk: 4, luk: 4 });
  });

  it("망토: 단계당 dex +1 + spd +1 (atk 안 붙음)", () => {
    expect(enhancementBonus("starlit_mantle", 3)).toEqual({ dex: 3, spd: 3 });
  });

  it("강화 불가 itemId 는 빈 보너스", () => {
    expect(enhancementBonus("empyrean_blade", 3)).toEqual({});
  });
});

describe("enhancement — nextEnhanceCost", () => {
  it("0→1: 30, 1→2: 60, …, 4→5: 250", () => {
    expect(nextEnhanceCost(0)).toEqual({ toLevel: 1, shards: 30 });
    expect(nextEnhanceCost(1)).toEqual({ toLevel: 2, shards: 60 });
    expect(nextEnhanceCost(2)).toEqual({ toLevel: 3, shards: 100 });
    expect(nextEnhanceCost(3)).toEqual({ toLevel: 4, shards: 150 });
    expect(nextEnhanceCost(4)).toEqual({ toLevel: 5, shards: 250 });
  });

  it("최대 단계 도달 시 null", () => {
    expect(nextEnhanceCost(5)).toBeNull();
    expect(nextEnhanceCost(99)).toBeNull();
  });

  it("음수/비정수 입력 → null", () => {
    expect(nextEnhanceCost(-1)).toBeNull();
    expect(nextEnhanceCost(1.5)).toBeNull();
  });
});

describe("enhancement — planEnhance", () => {
  it("정상 경로 — 별빛 조각 충분", () => {
    expect(planEnhance("starlit_blade", 0, 30)).toEqual({
      ok: true,
      toLevel: 1,
      shards: 30,
    });
    expect(planEnhance("starlit_blade", 4, 250)).toEqual({
      ok: true,
      toLevel: 5,
      shards: 250,
    });
  });

  it("강화 불가 itemId", () => {
    const r = planEnhance("empyrean_blade", 0, 1000);
    expect(r).toEqual({ ok: false, reason: "not_enhanceable" });
  });

  it("최대 단계", () => {
    const r = planEnhance("starlit_blade", 5, 1000);
    expect(r).toEqual({ ok: false, reason: "max_level" });
  });

  it("별빛 조각 부족", () => {
    const r = planEnhance("starlit_blade", 0, 29);
    expect(r).toEqual({ ok: false, reason: "insufficient_shards" });
  });

  it("잘못된 단계 (음수)", () => {
    const r = planEnhance("starlit_blade", -1, 1000);
    expect(r).toEqual({ ok: false, reason: "invalid_level" });
  });
});

describe("enhancement — resolveEnhancedItem", () => {
  it("강화 0 단계: 베이스 그대로 + 메타만 박힘", () => {
    const item = resolveEnhancedItem("starlit_blade", undefined, 0, "id-x");
    expect(item.bonus).toEqual({ atk: 27, str: 13 });
    expect(item.enhancementLevel).toBe(0);
    expect(item.instanceId).toBe("id-x");
  });

  it("강화 +3: 무기 bonus 에 atk +3 / str +3 누적", () => {
    const item = resolveEnhancedItem("starlit_blade", undefined, 3, "id-y");
    expect(item.bonus).toEqual({ atk: 30, str: 16 });
    expect(item.enhancementLevel).toBe(3);
  });

  it("강화 +5: 풀강 — 망토 bonus dex/spd 만 +5 (atk 미부착)", () => {
    const item = resolveEnhancedItem("starlit_mantle", undefined, 5, "id-z");
    expect(item.bonus).toEqual({ dex: 17, spd: 17, vit: 7 });
  });
});
