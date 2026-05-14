import { describe, expect, it } from "vitest";
import { MONSTERS } from "@/adventure/data/monsters";
import {
  BOSS_SLOTS,
  bossBaseMonster,
  bossDisplayName,
  bossSlotForFloor,
  mobPoolCount,
  mobPoolForFloor,
  pickMobFromPool,
  validateBossSlots,
} from "./floorPools";

describe("BOSS_SLOTS", () => {
  it("정확히 13개", () => {
    expect(BOSS_SLOTS).toHaveLength(13);
  });
  it("모든 슬롯의 monsterName 이 MONSTERS 에 존재", () => {
    const result = validateBossSlots();
    expect(result).toEqual({ ok: true, missing: [] });
  });
  it("real boss (앞 8개) 는 bossMultiplier 1.0, elite (뒤 5개) 는 2.0 이상", () => {
    for (let i = 0; i < 8; i += 1) {
      expect(BOSS_SLOTS[i].bossMultiplier).toBe(1.0);
    }
    for (let i = 8; i < 13; i += 1) {
      expect(BOSS_SLOTS[i].bossMultiplier).toBeGreaterThanOrEqual(2.0);
    }
  });
});

describe("bossSlotForFloor (floorPools)", () => {
  it("10/20/.../130 에 슬롯 매핑", () => {
    expect(bossSlotForFloor(10)).toBe(BOSS_SLOTS[0]);
    expect(bossSlotForFloor(20)).toBe(BOSS_SLOTS[1]);
    expect(bossSlotForFloor(130)).toBe(BOSS_SLOTS[12]);
  });
  it("130 초과 보스층은 마지막 슬롯 반복", () => {
    expect(bossSlotForFloor(140)).toBe(BOSS_SLOTS[12]);
    expect(bossSlotForFloor(200)).toBe(BOSS_SLOTS[12]);
  });
  it("비-보스층은 null", () => {
    expect(bossSlotForFloor(1)).toBe(null);
    expect(bossSlotForFloor(15)).toBe(null);
    expect(bossSlotForFloor(0)).toBe(null);
  });
});

describe("mobPoolForFloor", () => {
  it("MOB_POOLS 가 비어있지 않음 (WORLD_MAP 에서 enemies 가 있는 지역이 존재)", () => {
    expect(mobPoolCount()).toBeGreaterThan(0);
  });
  it("층 1~5 = 같은 풀, 6~10 = 다음 풀", () => {
    const p1 = mobPoolForFloor(1);
    const p5 = mobPoolForFloor(5);
    const p6 = mobPoolForFloor(6);
    expect(p1).toBe(p5);
    expect(p1).not.toBe(p6);
  });
  it("풀 끝나면 처음부터 순환", () => {
    const poolN = mobPoolCount();
    const first = mobPoolForFloor(1);
    // 5층씩 늘려 풀 끝까지 간 뒤 한 칸 더 = 첫 풀로 돌아옴.
    const wrapFloor = poolN * 5 + 1;
    expect(mobPoolForFloor(wrapFloor)).toBe(first);
  });
});

describe("pickMobFromPool", () => {
  it("주입된 rng=0 이면 첫 항목, rng=0.999 이면 마지막", () => {
    const pool = ["a", "b", "c", "d"];
    expect(pickMobFromPool(pool, () => 0)).toBe("a");
    expect(pickMobFromPool(pool, () => 0.999)).toBe("d");
  });
  it("빈 풀은 throw", () => {
    expect(() => pickMobFromPool([], () => 0)).toThrow();
  });
});

describe("bossBaseMonster / bossDisplayName", () => {
  it("real boss 슬롯의 베이스가 MONSTERS 에 존재", () => {
    const slot = BOSS_SLOTS[0]; // 광맥의 수호자
    expect(bossBaseMonster(slot)).toBe(MONSTERS[slot.monsterName]);
  });
  it("displayName override 없으면 monsterName 그대로", () => {
    const slot = BOSS_SLOTS[0];
    expect(bossDisplayName(slot)).toBe(slot.monsterName);
  });
  it("elite 슬롯은 displayName 으로 노출", () => {
    const slot = BOSS_SLOTS[8]; // F90 elite
    expect(slot.displayName).toBeTruthy();
    expect(bossDisplayName(slot)).toBe(slot.displayName);
  });
});
