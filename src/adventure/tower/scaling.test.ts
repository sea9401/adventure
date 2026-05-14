import { describe, expect, it } from "vitest";
import {
  bossSlotForFloor,
  isBossFloor,
  lastBossFloorAtOrBelow,
  scaledStats,
  startFloorAfterCheckpoint,
  TOWER_ATK_EXP,
  TOWER_DEF_EXP,
  TOWER_HP_EXP,
} from "./scaling";

describe("isBossFloor", () => {
  it("10의 배수가 보스층", () => {
    expect(isBossFloor(10)).toBe(true);
    expect(isBossFloor(20)).toBe(true);
    expect(isBossFloor(130)).toBe(true);
  });
  it("배수 아니면 false. 0/음수도 false.", () => {
    expect(isBossFloor(1)).toBe(false);
    expect(isBossFloor(11)).toBe(false);
    expect(isBossFloor(0)).toBe(false);
    expect(isBossFloor(-10)).toBe(false);
  });
});

describe("bossSlotForFloor", () => {
  it("10 → 0, 20 → 1, 130 → 12", () => {
    expect(bossSlotForFloor(10)).toBe(0);
    expect(bossSlotForFloor(20)).toBe(1);
    expect(bossSlotForFloor(130)).toBe(12);
  });
  it("비-보스층은 null", () => {
    expect(bossSlotForFloor(15)).toBe(null);
    expect(bossSlotForFloor(1)).toBe(null);
  });
});

describe("lastBossFloorAtOrBelow", () => {
  it("9 → 0, 15 → 10, 20 → 20, 89 → 80", () => {
    expect(lastBossFloorAtOrBelow(9)).toBe(0);
    expect(lastBossFloorAtOrBelow(15)).toBe(10);
    expect(lastBossFloorAtOrBelow(20)).toBe(20);
    expect(lastBossFloorAtOrBelow(89)).toBe(80);
  });
});

describe("startFloorAfterCheckpoint", () => {
  it("0 → 1 (첫 시도)", () => {
    expect(startFloorAfterCheckpoint(0)).toBe(1);
  });
  it("9 → 1 (보스 못 깸), 20 → 21 (F20 보스 클리어), 35 → 31", () => {
    expect(startFloorAfterCheckpoint(9)).toBe(1);
    expect(startFloorAfterCheckpoint(20)).toBe(21);
    expect(startFloorAfterCheckpoint(35)).toBe(31);
  });
});

describe("scaledStats", () => {
  const base = { hp: 100, atk: 40, def: 20, spd: 8 };

  it("층 1 = 베이스 그대로 (×1^exp = 1)", () => {
    const s = scaledStats(base, 1);
    expect(s.hp).toBe(100);
    expect(s.atk).toBe(40);
    expect(s.def).toBe(20);
    expect(s.spd).toBe(8);
  });

  it("층 수 증가 시 hp/atk/def 모두 증가, spd 는 변동 없음", () => {
    const s1 = scaledStats(base, 1);
    const s10 = scaledStats(base, 10);
    expect(s10.hp).toBeGreaterThan(s1.hp);
    expect(s10.atk).toBeGreaterThan(s1.atk);
    expect(s10.def).toBeGreaterThan(s1.def);
    expect(s10.spd).toBe(s1.spd);
  });

  it("공식 — hp×F^0.45, atk×F^0.25, def×F^0.25", () => {
    const f = 100;
    const s = scaledStats(base, f);
    expect(s.hp).toBe(Math.round(100 * Math.pow(f, TOWER_HP_EXP)));
    expect(s.atk).toBe(Math.round(40 * Math.pow(f, TOWER_ATK_EXP)));
    expect(s.def).toBe(Math.round(20 * Math.pow(f, TOWER_DEF_EXP)));
  });

  it("bossMultiplier 적용 — 베이스에 직접 곱한 값과 동일", () => {
    const f = 10;
    const s25 = scaledStats(base, f, 2.5);
    expect(s25.hp).toBe(Math.round(100 * 2.5 * Math.pow(f, TOWER_HP_EXP)));
    expect(s25.atk).toBe(Math.round(40 * 2.5 * Math.pow(f, TOWER_ATK_EXP)));
    expect(s25.def).toBe(Math.round(20 * 2.5 * Math.pow(f, TOWER_DEF_EXP)));
  });

  it("층 0 도 1 로 클램프 — hp/atk 가 0 되지 않도록", () => {
    const s = scaledStats(base, 0);
    expect(s.hp).toBeGreaterThanOrEqual(1);
    expect(s.atk).toBeGreaterThanOrEqual(1);
  });
});
