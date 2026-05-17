import { describe, it, expect } from "vitest";
import {
  TOWER_MODIFIER_POOL,
  currentWeeklyModifier,
  getTowerModifier,
  towerWeekIndex,
} from "./modifiers";

describe("tower modifiers — 풀", () => {
  it("풀은 10개 + 모두 고유 id (5막 PR-D2 — 별빛 옥좌의 환영 5종 추가)", () => {
    expect(TOWER_MODIFIER_POOL).toHaveLength(10);
    const ids = TOWER_MODIFIER_POOL.map((m) => m.id);
    expect(new Set(ids).size).toBe(10);
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

  it("주차가 바뀌면 풀 순서대로 회전 — 10주 cycle (5막 PR-D2)", () => {
    const baseMs = new Date("2026-05-11T00:00:00+09:00").getTime();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const ids: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      ids.push(currentWeeklyModifier(new Date(baseMs + i * weekMs)).id);
    }
    // 10주 사이 모두 다른 id (풀 10개 ↔ 10주 → 모두 고유).
    expect(new Set(ids).size).toBe(10);
    // 11번째 주는 첫 주와 동일 (cycle).
    const wk11 = currentWeeklyModifier(new Date(baseMs + 10 * weekMs));
    expect(wk11.id).toBe(ids[0]);
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
