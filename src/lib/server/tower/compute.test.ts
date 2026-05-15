import { describe, expect, it } from "vitest";
import { TOWER_DAILY_ATTEMPTS, type TowerState } from "@/adventure/tower/types";
import {
  TowerError,
  applyAutoStep,
  computeTowerOutcome,
  todayKey,
} from "./compute";

const emptyState: TowerState = {
  progress: { highestFloor: 0, claimedMilestones: [] },
  run: null,
  daily: null,
};

const today = "2026-05-14";

describe("computeTowerOutcome > start", () => {
  it("첫 시도 — daily.attempts=1, run.currentFloor=1", () => {
    const r = computeTowerOutcome({ state: emptyState, today }, { kind: "start" });
    expect(r.state.run?.currentFloor).toBe(1);
    expect(r.state.daily).toEqual({ date: today, attempts: 1 });
    expect(r.applied).toMatchObject({ kind: "start", currentFloor: 1 });
  });

  it("highestFloor=20 (F20 보스 클리어) 이면 다음 시도는 F21 부터", () => {
    const s: TowerState = {
      ...emptyState,
      progress: { highestFloor: 20, claimedMilestones: [10, 20] },
    };
    const r = computeTowerOutcome({ state: s, today }, { kind: "start" });
    expect(r.state.run?.currentFloor).toBe(21);
  });

  it("진행 중 run 있으면 run_in_progress 던짐", () => {
    const s: TowerState = {
      ...emptyState,
      run: { currentFloor: 5, startedAt: 0 },
    };
    expect(() =>
      computeTowerOutcome({ state: s, today }, { kind: "start" }),
    ).toThrow(/run_in_progress/);
  });

  it("daily 캡 도달이면 daily_cap_reached", () => {
    const s: TowerState = {
      ...emptyState,
      daily: { date: today, attempts: TOWER_DAILY_ATTEMPTS },
    };
    expect(() =>
      computeTowerOutcome({ state: s, today }, { kind: "start" }),
    ).toThrow(/daily_cap_reached/);
  });

  it("daily.date 가 다른 날이면 attempts 리셋 후 카운트 1", () => {
    const s: TowerState = {
      ...emptyState,
      daily: { date: "2026-05-13", attempts: 3 },
    };
    const r = computeTowerOutcome({ state: s, today }, { kind: "start" });
    expect(r.state.daily).toEqual({ date: today, attempts: 1 });
  });

  describe("startFloor 선택제", () => {
    const s: TowerState = {
      ...emptyState,
      progress: { highestFloor: 35, claimedMilestones: [10, 20, 30] },
    };

    it("startFloor=1 — 처음부터 다시 (낮은 보스 파밍용)", () => {
      const r = computeTowerOutcome(
        { state: s, today },
        { kind: "start", startFloor: 1 },
      );
      expect(r.state.run?.currentFloor).toBe(1);
    });

    it("startFloor=11 — 중간 체크포인트", () => {
      const r = computeTowerOutcome(
        { state: s, today },
        { kind: "start", startFloor: 11 },
      );
      expect(r.state.run?.currentFloor).toBe(11);
    });

    it("startFloor 미동봉 — 기존 동작(가장 높은 체크포인트)", () => {
      const r = computeTowerOutcome({ state: s, today }, { kind: "start" });
      expect(r.state.run?.currentFloor).toBe(31);
    });

    it("허용 목록 밖 (안 깬 보스 이후) → invalid_start_floor", () => {
      expect(() =>
        computeTowerOutcome(
          { state: s, today },
          { kind: "start", startFloor: 41 }, // F40 안 깸
        ),
      ).toThrow(/invalid_start_floor/);
    });

    it("잡몹층 (1, 11, 21, … 이 아님) → invalid_start_floor", () => {
      expect(() =>
        computeTowerOutcome(
          { state: s, today },
          { kind: "start", startFloor: 5 },
        ),
      ).toThrow(/invalid_start_floor/);
    });
  });
});

describe("computeTowerOutcome > fight_floor (win)", () => {
  const runState: TowerState = {
    progress: { highestFloor: 0, claimedMilestones: [] },
    run: { currentFloor: 1, startedAt: 0 },
    daily: { date: today, attempts: 1 },
  };

  it("F1 클리어 → run.currentFloor=2, highestFloor=1", () => {
    const r = computeTowerOutcome(
      { state: runState, today },
      { kind: "fight_floor", outcome: "win" },
    );
    expect(r.state.run?.currentFloor).toBe(2);
    expect(r.state.progress.highestFloor).toBe(1);
    expect(r.applied.outcome).toBe("win");
    expect(r.applied.newHighestFloor).toBe(1);
    expect(r.applied.milestone).toBeUndefined(); // 보스층 아님
  });

  it("F10 보스층 첫 클리어 → 마일스톤 수령 + highestFloor=10", () => {
    const s: TowerState = {
      progress: { highestFloor: 9, claimedMilestones: [] },
      run: { currentFloor: 10, startedAt: 0 },
      daily: { date: today, attempts: 1 },
    };
    const r = computeTowerOutcome(
      { state: s, today },
      { kind: "fight_floor", outcome: "win" },
    );
    expect(r.state.run?.currentFloor).toBe(11);
    expect(r.state.progress.highestFloor).toBe(10);
    expect(r.state.progress.claimedMilestones).toContain(10);
    expect(r.applied.milestone?.floor).toBe(10);
    expect(r.applied.milestone?.reward.gold).toBeGreaterThan(0);
  });

  it("F10 두 번째 클리어 (이미 수령) → 마일스톤 미발급", () => {
    const s: TowerState = {
      progress: { highestFloor: 15, claimedMilestones: [10] },
      run: { currentFloor: 10, startedAt: 0 },
      daily: { date: today, attempts: 1 },
    };
    const r = computeTowerOutcome(
      { state: s, today },
      { kind: "fight_floor", outcome: "win" },
    );
    expect(r.applied.milestone).toBeUndefined();
    // highestFloor 는 이미 더 큼 → newHighestFloor 미동봉
    expect(r.applied.newHighestFloor).toBeUndefined();
  });

  it("run 없을 때 fight 는 no_active_run", () => {
    expect(() =>
      computeTowerOutcome(
        { state: emptyState, today },
        { kind: "fight_floor", outcome: "win" },
      ),
    ).toThrow(/no_active_run/);
  });
});

describe("computeTowerOutcome > fight_floor (lose)", () => {
  it("사망 → run 종료, progress 변동 없음, daily 변동 없음", () => {
    const s: TowerState = {
      progress: { highestFloor: 5, claimedMilestones: [] },
      run: { currentFloor: 7, startedAt: 0 },
      daily: { date: today, attempts: 2 },
    };
    const r = computeTowerOutcome(
      { state: s, today },
      { kind: "fight_floor", outcome: "lose" },
    );
    expect(r.state.run).toBe(null);
    expect(r.state.progress).toEqual(s.progress);
    expect(r.state.daily).toEqual(s.daily);
    expect(r.applied.outcome).toBe("lose");
  });
});

describe("computeTowerOutcome > forfeit", () => {
  it("진행 중 run 즉시 종료, daily 환불 없음", () => {
    const s: TowerState = {
      progress: { highestFloor: 5, claimedMilestones: [] },
      run: { currentFloor: 8, startedAt: 0 },
      daily: { date: today, attempts: 2 },
    };
    const r = computeTowerOutcome({ state: s, today }, { kind: "forfeit" });
    expect(r.state.run).toBe(null);
    expect(r.state.daily?.attempts).toBe(2); // 환불 안 됨
  });

  it("run 없을 때 forfeit 은 no_active_run", () => {
    expect(() =>
      computeTowerOutcome({ state: emptyState, today }, { kind: "forfeit" }),
    ).toThrow(/no_active_run/);
  });
});

describe("computeTowerOutcome > start (revive)", () => {
  it("새 run 은 reviveAvailable=true 로 시작", () => {
    const r = computeTowerOutcome({ state: emptyState, today }, { kind: "start" });
    expect(r.state.run?.reviveAvailable).toBe(true);
  });
});

describe("applyAutoStep", () => {
  // 자동 시작 가능한 시점 = 잡몹층 (F1 처럼 10 의 배수가 아닌 층).
  const makeAutoState = (
    floor: number,
    reviveAvailable = true,
    highestFloor = 0,
    claimedMilestones: number[] = [],
  ): TowerState => ({
    progress: { highestFloor, claimedMilestones },
    run: { currentFloor: floor, startedAt: 0, reviveAvailable },
    daily: { date: today, attempts: 1 },
  });

  it("승리 — 다음 층이 잡몹이면 reason=null (루프 계속)", () => {
    const s = makeAutoState(11); // F12 가 잡몹 (다음 보스 F20)
    const r = applyAutoStep({ state: s, today }, "win");
    expect(r.reason).toBe(null);
    expect(r.state.run?.currentFloor).toBe(12);
    expect(r.state.run?.reviveAvailable).toBe(true); // 부활 그대로
  });

  it("승리 — 다음 층이 보스(10의 배수)면 reason=next_is_boss 로 멈춤", () => {
    const s = makeAutoState(19); // F20 이 보스
    const r = applyAutoStep({ state: s, today }, "win");
    expect(r.reason).toBe("next_is_boss");
    expect(r.state.run?.currentFloor).toBe(20);
  });

  it("승리 — 보스 클리어 후 마일스톤은 step.milestone 으로 동봉", () => {
    // F10 (보스) 에서 승리 → highestFloor=10, claimed=[10], 마일스톤 동봉.
    const s = makeAutoState(10, true, 0, []);
    const r = applyAutoStep({ state: s, today }, "win");
    expect(r.milestone).toBeDefined();
    expect(r.milestone?.floor).toBe(10);
  });

  it("패배 + reviveAvailable=true — 부활 소비, run 유지, 같은 층, reason=revive_used", () => {
    const s = makeAutoState(13, true);
    const r = applyAutoStep({ state: s, today }, "lose");
    expect(r.reason).toBe("revive_used");
    expect(r.state.run?.currentFloor).toBe(13); // 층 그대로
    expect(r.state.run?.reviveAvailable).toBe(false); // 소비됨
  });

  it("패배 + reviveAvailable=false — run 종료(=null), reason=death", () => {
    const s = makeAutoState(13, false);
    const r = applyAutoStep({ state: s, today }, "lose");
    expect(r.reason).toBe("death");
    expect(r.state.run).toBe(null);
  });

  it("패배 + reviveAvailable 미지정(레거시 런) — true 로 간주해 부활", () => {
    const s: TowerState = {
      progress: { highestFloor: 0, claimedMilestones: [] },
      // 의도적으로 reviveAvailable 누락 — 옛 클라가 저장한 런 시나리오.
      run: { currentFloor: 13, startedAt: 0 },
      daily: { date: today, attempts: 1 },
    };
    const r = applyAutoStep({ state: s, today }, "lose");
    expect(r.reason).toBe("revive_used");
    expect(r.state.run?.reviveAvailable).toBe(false);
  });

  it("run 없을 때 호출하면 no_active_run", () => {
    expect(() =>
      applyAutoStep({ state: emptyState, today }, "win"),
    ).toThrow(TowerError);
  });
});

describe("todayKey (KST)", () => {
  it("자정 직후 KST 는 그 날짜로 떨어짐 (UTC 와 다를 수 있음)", () => {
    // KST 자정 = UTC 15:00 전날.
    const utc1430 = new Date("2026-05-14T14:30:00Z"); // KST 2026-05-14 23:30
    expect(todayKey(utc1430)).toBe("2026-05-14");
    const utc1530 = new Date("2026-05-14T15:30:00Z"); // KST 2026-05-15 00:30
    expect(todayKey(utc1530)).toBe("2026-05-15");
  });
});
