import { describe, expect, it } from "vitest";
import { computePercentileTitles } from "./weeklyTiers";

function makeQualifiers(scores: number[]) {
  return scores.map((s, i) => ({ userId: `u${i + 1}`, weekHighest: s }));
}

describe("computePercentileTitles", () => {
  it("빈 입력 → 빈 결과", () => {
    expect(computePercentileTitles([]).size).toBe(0);
  });

  it("100명 — 5단계 분포", () => {
    const qs = makeQualifiers(
      Array.from({ length: 100 }, (_, i) => 100 - i),
    );
    const r = computePercentileTitles(qs);
    expect(r.get("u1")).toBe("top_1"); // rank 1, 1/100 = 1%
    expect(r.get("u2")).toBe("top_5"); // rank 2, 2/100 = 2%
    expect(r.get("u5")).toBe("top_5"); // rank 5, 5/100 = 5%
    expect(r.get("u6")).toBe("top_10"); // rank 6, 6/100 = 6%
    expect(r.get("u10")).toBe("top_10");
    expect(r.get("u11")).toBe("top_25");
    expect(r.get("u25")).toBe("top_25");
    expect(r.get("u26")).toBe("top_50");
    expect(r.get("u50")).toBe("top_50");
    expect(r.get("u51")).toBeUndefined(); // 51% 부터는 tier 없음
  });

  it("3명 — 1등만 top_50 (cut-off 엄격, 적은 인원에서는 자연 제한)", () => {
    const qs = makeQualifiers([100, 50, 30]);
    const r = computePercentileTitles(qs);
    expect(r.get("u1")).toBe("top_50"); // 1/3 ≈ 0.33 ≤ 0.5 → top_50
    expect(r.get("u2")).toBeUndefined(); // 2/3 ≈ 0.67 > 0.5
    expect(r.get("u3")).toBeUndefined();
  });

  it("동률은 같은 tier — 점수 동일한 유저들은 묶임", () => {
    // 200명 중 1·2등이 동률 → 둘 다 top_1
    const qs = makeQualifiers([
      100,
      100,
      ...Array.from({ length: 198 }, (_, i) => 90 - i),
    ]);
    const r = computePercentileTitles(qs);
    expect(r.get("u1")).toBe("top_1");
    expect(r.get("u2")).toBe("top_1");
    // u3 rank=3, 3/200 = 1.5% → top_5
    expect(r.get("u3")).toBe("top_5");
  });

  it("동률이 임계선에 걸리면 더 좋은 tier 로", () => {
    // 100명, rank 1~2 동률 95 → 둘 다 top_1.
    // rank 10·11 이 동률 50 → rank 10 은 top_10 (10/100=10%), rank 11 inherit top_10
    const scores = [
      95,
      95,
      ...Array.from({ length: 7 }, (_, i) => 90 - i),
      50,
      50,
      ...Array.from({ length: 89 }, (_, i) => 40 - i),
    ];
    const qs = makeQualifiers(scores);
    expect(qs.length).toBe(100);
    const r = computePercentileTitles(qs);
    expect(r.get("u10")).toBe("top_10");
    expect(r.get("u11")).toBe("top_10"); // 동률 inherit (11/100=11% 라도 위 tier 따라감)
    expect(r.get("u12")).toBe("top_25"); // 동률 아니므로 정상 산출
  });
});
