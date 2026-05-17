import { describe, expect, it } from "vitest";
import { scaledStats } from "./scaling";
import { TOWER_CHALLENGE_MODIFIER } from "./challengeScaling";

const base = { hp: 100, atk: 20, def: 10, spd: 8 };

describe("TOWER_CHALLENGE_MODIFIER — scaledStats 와 합산 시 1.5× HP/ATK/DEF", () => {
  it("F1 — 베이스 × 1.5 (HP/ATK/DEF) + SPD 불변", () => {
    const normal = scaledStats(base, 1, 1, undefined);
    const challenge = scaledStats(base, 1, 1, TOWER_CHALLENGE_MODIFIER);
    expect(challenge.hp).toBe(Math.round(normal.hp * 1.5));
    expect(challenge.atk).toBe(Math.round(normal.atk * 1.5));
    expect(challenge.def).toBe(Math.round(normal.def * 1.5));
    expect(challenge.spd).toBe(normal.spd); // SPD 곱 없음
  });

  it("F50 — 층 스케일링과 ×1.5 가 모두 적용 (HP/ATK/DEF)", () => {
    const normal = scaledStats(base, 50, 1, undefined);
    const challenge = scaledStats(base, 50, 1, TOWER_CHALLENGE_MODIFIER);
    // Math.round 의 끝자리 차이 한 단위는 허용.
    expect(challenge.hp).toBeGreaterThanOrEqual(Math.round(normal.hp * 1.5) - 1);
    expect(challenge.hp).toBeLessThanOrEqual(Math.round(normal.hp * 1.5) + 1);
    expect(challenge.atk).toBeGreaterThanOrEqual(Math.round(normal.atk * 1.5) - 1);
    expect(challenge.atk).toBeLessThanOrEqual(Math.round(normal.atk * 1.5) + 1);
    expect(challenge.spd).toBe(normal.spd);
  });

  it("보스층 (slot.bossMultiplier 2.0) — bossMult + challenge mod 모두 곱연산", () => {
    const challenge = scaledStats(base, 50, 2.0, TOWER_CHALLENGE_MODIFIER);
    const normal = scaledStats(base, 50, 2.0, undefined);
    expect(challenge.hp).toBeGreaterThanOrEqual(Math.round(normal.hp * 1.5) - 1);
    expect(challenge.atk).toBeGreaterThanOrEqual(Math.round(normal.atk * 1.5) - 1);
  });
});
