import { describe, expect, it } from "vitest";
import { ITEMS, type EquipItem } from "./items";
import {
  applyDropQuality,
  dropQualityPrefix,
  dropQualityTextClass,
  parseDropQuality,
  primaryPositiveStat,
  resolveDroppedItem,
  rollDropQuality,
} from "./dropQuality";

describe("rollDropQuality", () => {
  it("rng=0 → 기본(0), rng→1 직전 → 빼어난(2)", () => {
    expect(rollDropQuality(() => 0)).toBe(0);
    expect(rollDropQuality(() => 0.999999)).toBe(2);
  });

  it("기본 가중치(95/4/1) 경계 — r 가 95/100 직전이면 0, 직후면 1, 99/100 직후면 2", () => {
    // 합 = 100. r = rng()*100.
    expect(rollDropQuality(() => 0.949)).toBe(0);
    expect(rollDropQuality(() => 0.951)).toBe(1);
    expect(rollDropQuality(() => 0.985)).toBe(1);
    expect(rollDropQuality(() => 0.991)).toBe(2);
  });

  it("bias 가 비-기본 등급 가중치만 키운다 — bias=4 면 합=115, 0 컷이 95/115≈0.826", () => {
    expect(rollDropQuality(() => 0.82, 4)).toBe(0);
    expect(rollDropQuality(() => 0.83, 4)).toBe(1); // 95..111 / 115
    expect(rollDropQuality(() => 0.97, 4)).toBe(2); // 111..115 / 115
  });

  it("분포 근사 — 10k 굴림, 기본이 압도적(>90%) 이고 빼어난은 희소(<3%)", () => {
    const rng = Math.random;
    const counts = [0, 0, 0];
    const N = 10000;
    for (let i = 0; i < N; i += 1) counts[rollDropQuality(rng)] += 1;
    expect(counts[0] / N).toBeGreaterThan(0.9);
    expect(counts[2] / N).toBeLessThan(0.03);
    expect(counts[0] + counts[1] + counts[2]).toBe(N);
  });

  it("bias 가 높을수록 비-기본 등급 비율이 올라간다 (몬테카를로)", () => {
    const nonZeroRate = (bias: number) => {
      let nz = 0;
      for (let i = 0; i < 8000; i += 1) {
        if (rollDropQuality(Math.random, bias) > 0) nz += 1;
      }
      return nz / 8000;
    };
    expect(nonZeroRate(4)).toBeGreaterThan(nonZeroRate(1));
  });
});

describe("primaryPositiveStat", () => {
  it("무기는 atk, 방어구는 def 가 주력(최대 양수). 음수 보너스는 무시", () => {
    expect(primaryPositiveStat(ITEMS.bandit_dagger)).toBe("atk"); // {atk:4, dex:2}
    expect(primaryPositiveStat(ITEMS.golem_armor)).toBe("def"); // {def:6, atk:-1, spd:-3, luk:-1}
  });

  it("양수 보너스가 하나뿐이면 그 스탯", () => {
    expect(primaryPositiveStat(ITEMS.nymph_ring)).toBe("spd"); // {spd:2}
  });

  it("동률이면 슬롯 기본(weapon→atk) 우선", () => {
    const item: EquipItem = {
      name: "x",
      slot: "weapon",
      stats: [],
      bonus: { atk: 3, dex: 3 },
    };
    expect(primaryPositiveStat(item)).toBe("atk");
  });

  it("양수 보너스가 없으면 null", () => {
    const item: EquipItem = {
      name: "x",
      slot: "accessory",
      stats: [],
      bonus: { spd: -1 },
    };
    expect(primaryPositiveStat(item)).toBeNull();
    expect(primaryPositiveStat({ name: "y", slot: "weapon", stats: [] })).toBeNull();
  });
});

describe("applyDropQuality", () => {
  it("q=0 이면 베이스 그대로 + dropQuality 마커만", () => {
    const out = applyDropQuality(ITEMS.bandit_dagger, 0);
    expect(out.dropQuality).toBe(0);
    expect(out.bonus).toEqual(ITEMS.bandit_dagger.bonus);
    expect(out.stats).toEqual(ITEMS.bandit_dagger.stats);
  });

  it("주력 양수 스탯이 q 만큼 오르고 stats 문자열도 갱신", () => {
    const q1 = applyDropQuality(ITEMS.bandit_dagger, 1); // {atk:4,dex:2} → atk 5
    expect(q1.dropQuality).toBe(1);
    expect(q1.bonus?.atk).toBe(5);
    expect(q1.bonus?.dex).toBe(2);
    expect(q1.stats).toEqual([
      { label: "공격력", value: "+5" },
      { label: "민첩", value: "+2" },
    ]);

    const q2 = applyDropQuality(ITEMS.golem_armor, 2); // {def:6, atk:-1, spd:-3, luk:-1} → def 8
    expect(q2.bonus?.def).toBe(8);
    expect(q2.stats.find((s) => s.label === "방어력")?.value).toBe("+8");
    // 나머지(음수 포함)는 그대로.
    expect(q2.bonus?.atk).toBe(-1);
    expect(q2.bonus?.spd).toBe(-3);
  });

  it("양수 보너스가 없는 장비는 q>0 이라도 변동 없음(마커만)", () => {
    const noBonus: EquipItem = { name: "맨손", slot: "weapon", stats: [] };
    const out = applyDropQuality(noBonus, 2);
    expect(out.dropQuality).toBe(2);
    expect(out.bonus).toBeUndefined();
  });

  it("dropVariance.varianceTable 가 있으면 [2,3,4] 칸을 q 0/1/2 로 재사용", () => {
    const item: EquipItem = {
      name: "저수치검",
      slot: "weapon",
      stats: [{ label: "공격력", value: "+1" }],
      bonus: { atk: 1 },
      dropVariance: { varianceTable: { atk: [-1, 0, 0, 2, 4] } },
    };
    expect(applyDropQuality(item, 0).bonus?.atk).toBe(1); // 변동 없음
    expect(applyDropQuality(item, 1).bonus?.atk).toBe(3); // 1 + table[3]
    expect(applyDropQuality(item, 2).bonus?.atk).toBe(5); // 1 + table[4]
  });

  it("resolveDroppedItem(id, q) === applyDropQuality(ITEMS[id], q)", () => {
    expect(resolveDroppedItem("bandit_dagger", 2)).toEqual(
      applyDropQuality(ITEMS.bandit_dagger, 2),
    );
  });
});

describe("표시 헬퍼", () => {
  it("dropQualityPrefix — 0/null 은 빈 문자열, 1·2 는 '정교한 '/'빼어난 '", () => {
    expect(dropQualityPrefix(0)).toBe("");
    expect(dropQualityPrefix(undefined)).toBe("");
    expect(dropQualityPrefix(1)).toBe("정교한 ");
    expect(dropQualityPrefix(2)).toBe("빼어난 ");
  });

  it("dropQualityTextClass — 1·2 는 색 강조, 그 외는 기본 톤", () => {
    expect(dropQualityTextClass(1)).toContain("teal");
    expect(dropQualityTextClass(2)).toContain("amber");
    expect(dropQualityTextClass(0)).toBe(dropQualityTextClass(null));
  });

  it("parseDropQuality — '1'/'2'/1/2 만 통과, 그 외는 null", () => {
    expect(parseDropQuality("1")).toBe(1);
    expect(parseDropQuality(2)).toBe(2);
    expect(parseDropQuality("0")).toBeNull();
    expect(parseDropQuality(3)).toBeNull();
    expect(parseDropQuality("x")).toBeNull();
    expect(parseDropQuality(undefined)).toBeNull();
  });
});
