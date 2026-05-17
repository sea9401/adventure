import { describe, expect, it } from "vitest";
import {
  cooldownAfterAttempt,
  formatCooldownRemaining,
  nextAttemptAt,
} from "./bossCooldown";

const MIN = 60_000;

describe("cooldownAfterAttempt — 누진 단계", () => {
  it("1~3회차 → 15분", () => {
    expect(cooldownAfterAttempt(1)).toBe(15 * MIN);
    expect(cooldownAfterAttempt(2)).toBe(15 * MIN);
    expect(cooldownAfterAttempt(3)).toBe(15 * MIN);
  });
  it("4~6회차 → 30분", () => {
    expect(cooldownAfterAttempt(4)).toBe(30 * MIN);
    expect(cooldownAfterAttempt(5)).toBe(30 * MIN);
    expect(cooldownAfterAttempt(6)).toBe(30 * MIN);
  });
  it("7~9회차 → 1시간", () => {
    expect(cooldownAfterAttempt(7)).toBe(60 * MIN);
    expect(cooldownAfterAttempt(9)).toBe(60 * MIN);
  });
  it("10회+ → 3시간 반복", () => {
    expect(cooldownAfterAttempt(10)).toBe(180 * MIN);
    expect(cooldownAfterAttempt(50)).toBe(180 * MIN);
  });
  it("0회차 (도전 안 함) → 0", () => {
    expect(cooldownAfterAttempt(0)).toBe(0);
    expect(cooldownAfterAttempt(-5)).toBe(0);
  });
});

describe("cooldownAfterAttempt — 길드 % 감소", () => {
  it("0% 감소는 베이스 그대로", () => {
    expect(cooldownAfterAttempt(1, 0)).toBe(15 * MIN);
  });
  it("50% 감소: 15분 → 7.5분", () => {
    expect(cooldownAfterAttempt(1, 50)).toBe(Math.round(7.5 * MIN));
  });
  it("3시간(10회+) 30% 감소: 180분 → 126분", () => {
    expect(cooldownAfterAttempt(10, 30)).toBe(126 * MIN);
  });
  it("음수/100 이상은 clamp", () => {
    expect(cooldownAfterAttempt(1, -10)).toBe(15 * MIN);
    expect(cooldownAfterAttempt(1, 999)).toBe(Math.round(15 * MIN * 0.01));
  });
});

describe("nextAttemptAt", () => {
  it("lastAttemptAt null → 0 (즉시 가능)", () => {
    expect(nextAttemptAt(null, 5)).toBe(0);
  });
  it("attemptCount 0 → 0 (오늘 안 침)", () => {
    expect(nextAttemptAt(Date.now(), 0)).toBe(0);
  });
  it("3회 친 직후 (last=now) → now + 15분", () => {
    const now = 1_700_000_000_000;
    expect(nextAttemptAt(now, 3)).toBe(now + 15 * MIN);
  });
  it("길드 50% 감소 적용", () => {
    const now = 1_700_000_000_000;
    expect(nextAttemptAt(now, 7, 50)).toBe(now + 30 * MIN);
  });
});

describe("formatCooldownRemaining", () => {
  it("시간 단위 — 시간+분만", () => {
    expect(formatCooldownRemaining(2 * 3600 * 1000 + 15 * MIN)).toBe(
      "2시간 15분",
    );
  });
  it("분 단위 — 분+초", () => {
    expect(formatCooldownRemaining(12 * MIN + 34_000)).toBe("12분 34초");
  });
  it("초 단위", () => {
    expect(formatCooldownRemaining(5_000)).toBe("5초");
  });
  it("0 이하는 '0초'", () => {
    expect(formatCooldownRemaining(0)).toBe("0초");
    expect(formatCooldownRemaining(-1000)).toBe("0초");
  });
});
