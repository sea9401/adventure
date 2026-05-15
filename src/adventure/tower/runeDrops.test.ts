import { describe, expect, it } from "vitest";
import { rollBossClearReward } from "./runeDrops";

// 시드 시퀀스를 끝까지 돈 뒤 wrap-around. 명시적이라 디버깅 쉬움.
function seedRng(seq: number[]): () => number {
  let i = 0;
  return () => {
    const v = seq[i % seq.length];
    i += 1;
    return v;
  };
}

describe("rollBossClearReward — 토큰", () => {
  it("층대별 토큰 수", () => {
    const noRoll = seedRng([0]);
    expect(rollBossClearReward(10, noRoll).tokens).toBe(1);
    expect(rollBossClearReward(29, noRoll).tokens).toBe(1);
    expect(rollBossClearReward(30, noRoll).tokens).toBe(2);
    expect(rollBossClearReward(59, noRoll).tokens).toBe(2);
    expect(rollBossClearReward(60, noRoll).tokens).toBe(3);
    expect(rollBossClearReward(99, noRoll).tokens).toBe(3);
    expect(rollBossClearReward(100, noRoll).tokens).toBe(5);
    expect(rollBossClearReward(130, noRoll).tokens).toBe(5);
  });
});

describe("rollBossClearReward — 룬 개수", () => {
  it("F10 — 기댓값 1.0, 정확히 1개", () => {
    // rng 시퀀스: [extraCheck, id, grade] — F10은 extra=0.0 이라 첫 rng 가 id 로 쓰임
    // F10 의 경우 expected=1.0 → guaranteed=1, extraChance=0.0 → rng() 한 번도 extra 안 씀
    const r = rollBossClearReward(10, seedRng([0.5, 0.5]));
    const total = r.runes.reduce((s, d) => s + d.count, 0);
    expect(total).toBe(1);
  });

  it("F100 — 기댓값 2.0, 항상 2개", () => {
    // expected=2.0 → guaranteed=2, extraChance=0 → 항상 2 굴림
    const r = rollBossClearReward(100, seedRng([0.5, 0.5]));
    const total = r.runes.reduce((s, d) => s + d.count, 0);
    expect(total).toBe(2);
  });

  it("F60 — 기댓값 1.5, extra 확률 0.5", () => {
    // F60 expected=1.5, guaranteed=1, extraChance=0.5
    // extra 굴림 rng < 0.5 → 추가 1개, else 1개만
    const yes = rollBossClearReward(60, seedRng([0.1, 0.5, 0.5, 0.5]));
    expect(yes.runes.reduce((s, d) => s + d.count, 0)).toBe(2);
    const no = rollBossClearReward(60, seedRng([0.9, 0.5, 0.5]));
    expect(no.runes.reduce((s, d) => s + d.count, 0)).toBe(1);
  });
});

describe("rollBossClearReward — 등급 분포", () => {
  it("F10 은 무조건 1등급", () => {
    // F10 expected=1.0, guaranteed=1, no extra roll. seq = [id, grade]
    // weights={1:1.0} → 어떤 grade roll 값이든 1등급
    for (const g of [0.0, 0.5, 0.99]) {
      const r = rollBossClearReward(10, seedRng([0.5, g]));
      expect(r.runes[0].grade).toBe(1);
    }
  });

  it("F30 — 0.65 → 1등급, 0.85 → 2등급 (weights 0.7/0.3)", () => {
    // F30 expected=1.2, extraChance=0.2. extra rng 0.9 → no extra. seq=[extra, id, grade]
    const g1 = rollBossClearReward(30, seedRng([0.9, 0.5, 0.65]));
    expect(g1.runes[0].grade).toBe(1);
    const g2 = rollBossClearReward(30, seedRng([0.9, 0.5, 0.85]));
    expect(g2.runes[0].grade).toBe(2);
  });

  it("F110 — 5등급 가능", () => {
    // F110 weights={3:0.15, 4:0.45, 5:0.4}, total=1.0
    // roll=0.95 → 0.95 - 0.15 = 0.8 - 0.45 = 0.35 - 0.4 = -0.05 → 5등급
    // expected=2.0, no extra. seq=[id, grade, id, grade]
    const r = rollBossClearReward(110, seedRng([0.5, 0.95, 0.5, 0.95]));
    expect(r.runes[0].grade).toBe(5);
  });
});

describe("rollBossClearReward — 같은 (id, grade) 합산", () => {
  it("같은 시드로 두 번 굴리면 count 가 합산", () => {
    // F100 expected=2.0, guaranteed=2. 동일 id index + 동일 grade roll → 묶음 1
    const r = rollBossClearReward(100, seedRng([0.0, 0.0]));
    expect(r.runes.length).toBe(1);
    expect(r.runes[0].count).toBe(2);
  });
});
