import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRewardOutbox,
  readRewardOutbox,
  writeRewardOutbox,
} from "./offlineRewardOutbox";
import type { OfflineSimResult } from "./offlineSim";

// 테스트 환경은 node — window/localStorage 가 없으니 최소 stub 박아둔다.
function setupLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: () => null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, String(v));
    },
  };
  vi.stubGlobal("window", { localStorage: storage });
  return store;
}

const SAMPLE_RESULT: OfflineSimResult = {
  simulatedMs: 1_500_000,
  cappedByLimit: true,
  battles: 12,
  wins: 12,
  killsByName: { 슬라임: 12 },
  expGained: 240,
  expBonusApplied: false,
  goldGained: 60,
  materialsGained: { slime_chunk: 36 },
  equipsGained: [],
  recipesLearned: [],
  potionsConsumed: {},
  finalPlayerHp: 80,
  died: false,
};

describe("offlineRewardOutbox", () => {
  beforeEach(() => {
    setupLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("write → read 라운드 트립으로 같은 result 가 복원된다", () => {
    writeRewardOutbox(SAMPLE_RESULT, "user-a");
    const got = readRewardOutbox("user-a");
    expect(got).toEqual(SAMPLE_RESULT);
  });

  it("clear 후엔 null", () => {
    writeRewardOutbox(SAMPLE_RESULT, "user-a");
    clearRewardOutbox();
    expect(readRewardOutbox("user-a")).toBeNull();
  });

  it("저장된 outbox 는 다른 userId 로 읽으면 null + 자동 정리", () => {
    const store = setupLocalStorage();
    writeRewardOutbox(SAMPLE_RESULT, "user-a");
    expect(store.size).toBe(1);
    expect(readRewardOutbox("user-b")).toBeNull();
    // 다른 사용자 outbox 는 leak 안 되게 정리됨.
    expect(store.size).toBe(0);
  });

  it("익명 (userId=null) 도 같은 null 끼리 매치", () => {
    writeRewardOutbox(SAMPLE_RESULT, null);
    expect(readRewardOutbox(null)).toEqual(SAMPLE_RESULT);
  });

  it("익명 outbox 를 로그인 상태로 읽으면 null + 정리", () => {
    const store = setupLocalStorage();
    writeRewardOutbox(SAMPLE_RESULT, null);
    expect(readRewardOutbox("user-a")).toBeNull();
    expect(store.size).toBe(0);
  });

  it("손상된 JSON 도 throw 하지 않고 null", () => {
    setupLocalStorage().set("offline-reward-pending.v1", "{not-json");
    expect(readRewardOutbox("user-a")).toBeNull();
  });

  it("payload 에 result 가 없으면 null", () => {
    setupLocalStorage().set(
      "offline-reward-pending.v1",
      JSON.stringify({ userId: "user-a" }),
    );
    expect(readRewardOutbox("user-a")).toBeNull();
  });

  it("같은 키에 다시 쓰면 덮어씀 (= 가장 최근 sim 만 보존)", () => {
    writeRewardOutbox(SAMPLE_RESULT, "user-a");
    const newer: OfflineSimResult = {
      ...SAMPLE_RESULT,
      expGained: 999,
      battles: 99,
    };
    writeRewardOutbox(newer, "user-a");
    expect(readRewardOutbox("user-a")).toEqual(newer);
  });
});
