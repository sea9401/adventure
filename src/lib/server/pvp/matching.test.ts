import { describe, it, expect, vi } from "vitest";
import { pickFromPool, type OpponentCandidate } from "./matching";

function mk(userId: string, rating: number): OpponentCandidate {
  return { userId, name: userId, rating };
}

describe("pickFromPool — Elo 범위 단계 선택", () => {
  it("빈 풀이면 null", () => {
    expect(pickFromPool([], 1000)).toBeNull();
  });

  it("±200 안에 있는 후보가 있으면 그 안에서 선택 (더 넓은 범위 후보 무시)", () => {
    const pool = [
      mk("near", 1100),
      mk("mid", 1400),
      mk("far", 2000),
    ];
    vi.spyOn(Math, "random").mockReturnValue(0);
    const pick = pickFromPool(pool, 1000);
    expect(pick?.userId).toBe("near");
  });

  it("±200 빈 풀 → ±500 으로 확장", () => {
    const pool = [mk("mid", 1450), mk("far", 2200)];
    vi.spyOn(Math, "random").mockReturnValue(0);
    const pick = pickFromPool(pool, 1000);
    expect(pick?.userId).toBe("mid");
  });

  it("±500 빈 풀 → ±1000 으로 확장", () => {
    const pool = [mk("far1", 1800), mk("farther", 2200)];
    vi.spyOn(Math, "random").mockReturnValue(0);
    const pick = pickFromPool(pool, 1000);
    expect(pick?.userId).toBe("far1");
  });

  it("모든 범위 빈 풀 → 전체에서 무작위 (그래도 후보 있으면 null 아님)", () => {
    const pool = [mk("very-far", 3000)];
    vi.spyOn(Math, "random").mockReturnValue(0);
    const pick = pickFromPool(pool, 1000);
    expect(pick?.userId).toBe("very-far");
  });

  it("같은 범위 내 다수 후보 — Math.random 으로 인덱스 선택", () => {
    const pool = [mk("a", 1050), mk("b", 1100), mk("c", 1150)];
    // 0.99 * 3 = 2.97 → floor 2 → "c"
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(pickFromPool(pool, 1000)?.userId).toBe("c");
    // 0.5 * 3 = 1.5 → floor 1 → "b"
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(pickFromPool(pool, 1000)?.userId).toBe("b");
  });

  it("범위 경계 포함 (절댓값 ≤ range)", () => {
    const pool = [mk("edge", 1200)];
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickFromPool(pool, 1000)?.userId).toBe("edge");
  });
});
