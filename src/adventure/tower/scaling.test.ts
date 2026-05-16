import { describe, expect, it } from "vitest";
import {
  availableStartFloors,
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

describe("availableStartFloors", () => {
  it("highest=0 → [1] (첫 시도)", () => {
    expect(availableStartFloors(0)).toEqual([1]);
  });
  it("highest=9 → [1] (F10 보스 못 깸)", () => {
    expect(availableStartFloors(9)).toEqual([1]);
  });
  it("highest=10 → [1, 11] (F10 클리어, 11부터 시작 가능)", () => {
    expect(availableStartFloors(10)).toEqual([1, 11]);
  });
  it("highest=35 → [1, 11, 21, 31] (F10/20/30 클리어)", () => {
    expect(availableStartFloors(35)).toEqual([1, 11, 21, 31]);
  });
  it("highest=100 → [1, 11, …, 101]", () => {
    expect(availableStartFloors(100)).toEqual([
      1, 11, 21, 31, 41, 51, 61, 71, 81, 91, 101,
    ]);
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

  it("modifier 미지정 시 기존 스탯 보존 (회귀 가드)", () => {
    const s = scaledStats(base, 50);
    const sNone = scaledStats(base, 50, 1, undefined);
    expect(sNone).toEqual(s);
  });

  it("modifier 적용 — enemyHpMult ×1.25 시 hp 만 25% 증가", () => {
    const f = 20;
    const mod = { id: "heavy" as const, name: "둔중한 기운", description: "", enemyHpMult: 1.25 };
    const s = scaledStats(base, f, 1, mod);
    const sNone = scaledStats(base, f);
    expect(s.hp).toBe(Math.round(sNone.hp * 1.25));
    expect(s.atk).toBe(sNone.atk);
    expect(s.def).toBe(sNone.def);
    expect(s.spd).toBe(sNone.spd);
  });

  it("modifier 적용 — enemySpdMult 도 반영 (SPD 도 변동 가능)", () => {
    const mod = { id: "stormy" as const, name: "거센 폭풍", description: "", enemySpdMult: 1.25 };
    const s = scaledStats(base, 10, 1, mod);
    expect(s.spd).toBe(Math.round(8 * 1.25));
  });

  it("modifier 균등 ×1.10 — 모든 스탯 비례 증가 (round 한 자리 오차 허용)", () => {
    const mod = {
      id: "capricious" as const,
      name: "변덕스러운 운명",
      description: "",
      enemyHpMult: 1.1,
      enemyAtkMult: 1.1,
      enemyDefMult: 1.1,
      enemySpdMult: 1.1,
    };
    const sNone = scaledStats(base, 30);
    const s = scaledStats(base, 30, 1, mod);
    // round 순서 차이로 ±1 가능 — "근사 1.1배" 만 확인.
    expect(Math.abs(s.hp - Math.round(sNone.hp * 1.1))).toBeLessThanOrEqual(1);
    expect(Math.abs(s.atk - Math.round(sNone.atk * 1.1))).toBeLessThanOrEqual(1);
    expect(Math.abs(s.def - Math.round(sNone.def * 1.1))).toBeLessThanOrEqual(1);
    expect(Math.abs(s.spd - Math.round(sNone.spd * 1.1))).toBeLessThanOrEqual(1);
  });
});
