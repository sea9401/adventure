import { describe, expect, it } from "vitest";
import type { EquipItem } from "./items";
import {
  applyCraftTier,
  craftHasVariance,
  craftTierSuffix,
  craftVarianceSummary,
  rollCraftTier,
  type CraftTier,
} from "./craftQuality";

const bat: EquipItem = {
  name: "야구 방망이",
  slot: "weapon",
  stats: [{ label: "공격력", value: "+3" }],
  bonus: { atk: 3 },
};

const hood: EquipItem = {
  name: "박쥐가죽 후드",
  slot: "armor",
  stats: [
    { label: "방어력", value: "+1" },
    { label: "속도", value: "+3" },
  ],
  bonus: { def: 1, spd: 3 },
};

describe("applyCraftTier — variance(u)", () => {
  it("일반(0)은 베이스 그대로 + craftTier 마커", () => {
    const r = applyCraftTier(bat, { variance: { atk: 1 } }, 0);
    expect(r.bonus?.atk).toBe(3);
    expect(r.stats).toEqual(bat.stats);
    expect(r.craftTier).toBe(0);
  });

  it("등급 오프셋이 주력 스탯에만 적용된다", () => {
    const tiers: { t: CraftTier; atk: number }[] = [
      { t: -2, atk: 1 },
      { t: -1, atk: 2 },
      { t: 0, atk: 3 },
      { t: 1, atk: 4 },
      { t: 2, atk: 5 },
    ];
    for (const { t, atk } of tiers) {
      const r = applyCraftTier(bat, { variance: { atk: 1 } }, t);
      expect(r.bonus?.atk).toBe(atk);
      expect(r.stats[0]).toEqual({ label: "공격력", value: (atk >= 0 ? "+" : "") + atk });
      expect(r.craftTier).toBe(t);
    }
  });

  it("변동 안 주는 스탯은 고정 — hood 의 def 는 그대로, spd 만 흔들림", () => {
    const r = applyCraftTier(hood, { variance: { spd: 1 } }, 2);
    expect(r.bonus?.def).toBe(1);
    expect(r.bonus?.spd).toBe(5);
    expect(r.stats).toEqual([
      { label: "방어력", value: "+1" },
      { label: "속도", value: "+5" },
    ]);
  });

  it("변동 정의가 없으면 어느 등급이든 베이스 그대로 (마커만)", () => {
    const r = applyCraftTier(bat, {}, 2);
    expect(r.bonus?.atk).toBe(3);
    expect(r.craftTier).toBe(2);
  });
});

describe("applyCraftTier — varianceTable", () => {
  it("표가 variance 보다 우선하고 등급별 델타를 직접 적용한다", () => {
    const v = { variance: { atk: 1 }, varianceTable: { atk: [-1, 0, 0, 2, 4] as const } };
    expect(applyCraftTier(bat, v, -2).bonus?.atk).toBe(2); // 3 + (-1)
    expect(applyCraftTier(bat, v, -1).bonus?.atk).toBe(3); // 3 + 0
    expect(applyCraftTier(bat, v, 1).bonus?.atk).toBe(5); // 3 + 2
    expect(applyCraftTier(bat, v, 2).bonus?.atk).toBe(7); // 3 + 4
  });
});

describe("rollCraftTier", () => {
  it("rng 경계값으로 5등급을 결정적으로 매핑한다 (가중치 6/22/44/22/6)", () => {
    // 누적: 불량 [0,6) / 하급 [6,28) / 일반 [28,72) / 고급 [72,94) / 걸작 [94,100)
    expect(rollCraftTier(() => 0.0)).toBe(-2);
    expect(rollCraftTier(() => 0.05)).toBe(-2);
    expect(rollCraftTier(() => 0.06)).toBe(-1);
    expect(rollCraftTier(() => 0.27)).toBe(-1);
    expect(rollCraftTier(() => 0.5)).toBe(0);
    expect(rollCraftTier(() => 0.71)).toBe(0);
    expect(rollCraftTier(() => 0.72)).toBe(1);
    expect(rollCraftTier(() => 0.93)).toBe(1);
    expect(rollCraftTier(() => 0.94)).toBe(2);
    expect(rollCraftTier(() => 0.999)).toBe(2);
  });

  it("분포가 대략 가중치를 따른다", () => {
    let i = 0;
    const N = 100_000;
    const counts: Record<number, number> = { [-2]: 0, [-1]: 0, 0: 0, 1: 0, 2: 0 };
    for (let n = 0; n < N; n++) {
      const t = rollCraftTier(() => ((i = (i * 1103515245 + 12345) & 0x7fffffff), i / 0x80000000));
      counts[t]++;
    }
    expect(counts[0] / N).toBeGreaterThan(0.4);
    expect(counts[0] / N).toBeLessThan(0.48);
    expect(counts[2] / N).toBeGreaterThan(0.03);
    expect(counts[2] / N).toBeLessThan(0.09);
    expect(counts[-2] / N).toBeGreaterThan(0.03);
    expect(counts[-2] / N).toBeLessThan(0.09);
  });
});

describe("helpers", () => {
  it("craftHasVariance", () => {
    expect(craftHasVariance({})).toBe(false);
    expect(craftHasVariance({ variance: {} })).toBe(false);
    expect(craftHasVariance({ variance: { atk: 0 } })).toBe(false);
    expect(craftHasVariance({ variance: { atk: 1 } })).toBe(true);
    expect(craftHasVariance({ varianceTable: { atk: [-1, 0, 0, 1, 2] } })).toBe(true);
  });

  it("craftTierSuffix", () => {
    expect(craftTierSuffix(null)).toBe("");
    expect(craftTierSuffix(undefined)).toBe("");
    expect(craftTierSuffix(0)).toBe("");
    expect(craftTierSuffix(2)).toBe(" ⟨걸작⟩");
    expect(craftTierSuffix(-2)).toBe(" ⟨불량⟩");
  });

  it("craftVarianceSummary", () => {
    expect(craftVarianceSummary(bat, {})).toBeNull();
    expect(craftVarianceSummary(bat, { variance: { atk: 1 } })).toBe("공격력 +1~+5");
    expect(craftVarianceSummary(hood, { variance: { spd: 1 } })).toBe("속도 +1~+5");
  });
});
