import { describe, it, expect } from "vitest";
import {
  TOWER_MODIFIER_POOL,
  currentWeeklyModifier,
  getTowerModifier,
  towerWeekIndex,
} from "./modifiers";

describe("tower modifiers — 풀", () => {
  it("풀은 5개 + 모두 고유 id", () => {
    expect(TOWER_MODIFIER_POOL).toHaveLength(5);
    const ids = TOWER_MODIFIER_POOL.map((m) => m.id);
    expect(new Set(ids).size).toBe(5);
  });

  it("각 풀 항목은 effect 멀티플라이어 최소 1개 보유", () => {
    for (const m of TOWER_MODIFIER_POOL) {
      const hasEffect =
        m.enemyHpMult !== undefined ||
        m.enemyAtkMult !== undefined ||
        m.enemyDefMult !== undefined ||
        m.enemySpdMult !== undefined;
      expect(hasEffect).toBe(true);
    }
  });
});

describe("currentWeeklyModifier — deterministic 선택", () => {
  // 2026-05-11 (월) 00:00 KST = 2026-05-10 15:00 UTC. 그 주차 인덱스 i 의 mod 5 가 결과.
  it("같은 주차 입력은 같은 모디파이어 반환", () => {
    const monMid = new Date("2026-05-11T00:00:00+09:00");
    const wedAfternoon = new Date("2026-05-13T15:30:00+09:00");
    const sunNight = new Date("2026-05-17T23:59:00+09:00");
    expect(currentWeeklyModifier(monMid).id).toBe(currentWeeklyModifier(wedAfternoon).id);
    expect(currentWeeklyModifier(monMid).id).toBe(currentWeeklyModifier(sunNight).id);
  });

  it("주차가 바뀌면 풀 순서대로 회전", () => {
    const wk1 = currentWeeklyModifier(new Date("2026-05-11T00:00:00+09:00"));
    const wk2 = currentWeeklyModifier(new Date("2026-05-18T00:00:00+09:00"));
    const wk3 = currentWeeklyModifier(new Date("2026-05-25T00:00:00+09:00"));
    const wk4 = currentWeeklyModifier(new Date("2026-06-01T00:00:00+09:00"));
    const wk5 = currentWeeklyModifier(new Date("2026-06-08T00:00:00+09:00"));
    const wk6 = currentWeeklyModifier(new Date("2026-06-15T00:00:00+09:00"));
    // 5주 cycle — wk6 가 wk1 과 동일해야.
    expect(wk6.id).toBe(wk1.id);
    // 5주 사이 모두 다른 id.
    const uniq = new Set([wk1.id, wk2.id, wk3.id, wk4.id, wk5.id]);
    expect(uniq.size).toBe(5);
  });

  it("towerWeekIndex 가 7일마다 1씩 증가", () => {
    const i1 = towerWeekIndex(new Date("2026-05-11T00:00:00+09:00"));
    const i2 = towerWeekIndex(new Date("2026-05-18T00:00:00+09:00"));
    expect(i2 - i1).toBe(1);
  });
});

describe("getTowerModifier — id 룩업", () => {
  it("id 로 풀 항목 반환", () => {
    expect(getTowerModifier("stormy").name).toBe("거센 폭풍");
    expect(getTowerModifier("iron").name).toBe("단단한 갑주");
  });

  it("none 은 noop 모디파이어 반환", () => {
    const none = getTowerModifier("none");
    expect(none.enemyHpMult).toBeUndefined();
    expect(none.enemyAtkMult).toBeUndefined();
  });
});
