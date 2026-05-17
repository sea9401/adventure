import { describe, expect, it } from "vitest";
import {
  TOWER_CHALLENGE_DAILY_ATTEMPTS,
  type TowerChallengeState,
} from "@/adventure/tower/challengeTypes";
import {
  TowerChallengeError,
  computeTowerChallengeOutcome,
  isChallengeBossClear,
} from "./compute";

const emptyState: TowerChallengeState = {
  progress: { highestFloor: 0 },
  run: null,
  daily: null,
};

const today = "2026-05-18";

describe("computeTowerChallengeOutcome > start", () => {
  it("첫 시도 — F1 고정 + daily.attempts=1", () => {
    const r = computeTowerChallengeOutcome(
      { state: emptyState, today },
      { kind: "start" },
    );
    expect(r.state.run?.currentFloor).toBe(1);
    expect(r.state.daily).toEqual({ date: today, attempts: 1 });
    expect(r.applied).toMatchObject({ kind: "start", currentFloor: 1 });
  });

  it("highestFloor=40 도달자도 항상 F1 부터 (체크포인트 없음)", () => {
    const s: TowerChallengeState = { ...emptyState, progress: { highestFloor: 40 } };
    const r = computeTowerChallengeOutcome({ state: s, today }, { kind: "start" });
    expect(r.state.run?.currentFloor).toBe(1);
    expect(r.state.progress.highestFloor).toBe(40);
  });

  it("진행 중 run 있으면 run_in_progress", () => {
    const s: TowerChallengeState = {
      ...emptyState,
      run: { currentFloor: 5, startedAt: 0 },
    };
    expect(() =>
      computeTowerChallengeOutcome({ state: s, today }, { kind: "start" }),
    ).toThrow(TowerChallengeError);
  });

  it("daily 캡 도달이면 daily_cap_reached", () => {
    const s: TowerChallengeState = {
      ...emptyState,
      daily: { date: today, attempts: TOWER_CHALLENGE_DAILY_ATTEMPTS },
    };
    expect(() =>
      computeTowerChallengeOutcome({ state: s, today }, { kind: "start" }),
    ).toThrow(/daily_cap_reached/);
  });

  it("daily.date 가 다른 날이면 attempts 리셋 후 카운트 1", () => {
    const s: TowerChallengeState = {
      ...emptyState,
      daily: { date: "2026-05-17", attempts: 3 },
    };
    const r = computeTowerChallengeOutcome({ state: s, today }, { kind: "start" });
    expect(r.state.daily).toEqual({ date: today, attempts: 1 });
  });
});

describe("computeTowerChallengeOutcome > fight_floor", () => {
  const inRun = (floor: number): TowerChallengeState => ({
    progress: { highestFloor: floor - 1 },
    run: { currentFloor: floor, startedAt: 0 },
    daily: { date: today, attempts: 1 },
  });

  it("승리 — currentFloor +1, run 유지", () => {
    const r = computeTowerChallengeOutcome(
      { state: inRun(5), today },
      { kind: "fight_floor", outcome: "win" },
    );
    expect(r.state.run?.currentFloor).toBe(6);
    expect(r.applied.outcome).toBe("win");
  });

  it("보스층(F10) 승리 — highestFloor=10 갱신 + newHighestFloor 동봉", () => {
    const r = computeTowerChallengeOutcome(
      { state: inRun(10), today },
      { kind: "fight_floor", outcome: "win" },
    );
    expect(r.state.progress.highestFloor).toBe(10);
    expect(r.applied.newHighestFloor).toBe(10);
  });

  it("F50 보스 클리어 시점은 compute 가 boss-clear 만 판별 — 칭호는 apply 가 부여", () => {
    const r = computeTowerChallengeOutcome(
      { state: inRun(50), today },
      { kind: "fight_floor", outcome: "win" },
    );
    expect(isChallengeBossClear(r.applied, 50)).toBe(true);
  });

  it("패배 — run=null, highestFloor 변동 없음", () => {
    const r = computeTowerChallengeOutcome(
      { state: inRun(7), today },
      { kind: "fight_floor", outcome: "lose" },
    );
    expect(r.state.run).toBeNull();
    expect(r.state.progress.highestFloor).toBe(6);
    expect(r.applied.outcome).toBe("lose");
  });

  it("run 없으면 no_active_run", () => {
    expect(() =>
      computeTowerChallengeOutcome(
        { state: emptyState, today },
        { kind: "fight_floor", outcome: "win" },
      ),
    ).toThrow(/no_active_run/);
  });

  it("non-보스층 승리 — newHighestFloor 동봉 (이미 highestFloor 보다 높을 때)", () => {
    const s: TowerChallengeState = {
      progress: { highestFloor: 4 },
      run: { currentFloor: 5, startedAt: 0 },
      daily: { date: today, attempts: 1 },
    };
    const r = computeTowerChallengeOutcome(
      { state: s, today },
      { kind: "fight_floor", outcome: "win" },
    );
    expect(r.state.progress.highestFloor).toBe(5);
    expect(r.applied.newHighestFloor).toBe(5);
  });
});

describe("computeTowerChallengeOutcome > forfeit", () => {
  it("run=null, daily/progress 보존, 시도 환불 없음", () => {
    const s: TowerChallengeState = {
      progress: { highestFloor: 12 },
      run: { currentFloor: 15, startedAt: 0 },
      daily: { date: today, attempts: 2 },
    };
    const r = computeTowerChallengeOutcome({ state: s, today }, { kind: "forfeit" });
    expect(r.state.run).toBeNull();
    expect(r.state.daily?.attempts).toBe(2);
    expect(r.state.progress.highestFloor).toBe(12);
  });

  it("run 없으면 no_active_run", () => {
    expect(() =>
      computeTowerChallengeOutcome({ state: emptyState, today }, { kind: "forfeit" }),
    ).toThrow(/no_active_run/);
  });
});

describe("isChallengeBossClear", () => {
  it("fight_floor + win + 보스층 → true", () => {
    expect(
      isChallengeBossClear({ kind: "fight_floor", outcome: "win" }, 50),
    ).toBe(true);
  });

  it("non-보스층 승리 → false", () => {
    expect(
      isChallengeBossClear({ kind: "fight_floor", outcome: "win" }, 7),
    ).toBe(false);
  });

  it("보스층 패배 → false", () => {
    expect(
      isChallengeBossClear({ kind: "fight_floor", outcome: "lose" }, 50),
    ).toBe(false);
  });

  it("start 액션 → false", () => {
    expect(isChallengeBossClear({ kind: "start", currentFloor: 1 }, 1)).toBe(false);
  });
});
