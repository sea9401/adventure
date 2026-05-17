// 고탑 도전 모드 서버측 순수 계산 — tower/compute.ts 의 부분집합 (auto/milestone/checkpoint 제거).
// 액션 처리 두 단계:
//   1) 이 파일의 순수 함수: 상태 + 액션 + outcome → 새 상태/적용 결과
//   2) apply.ts: DB 트랜잭션 + 서버 battle simulation + F50 칭호 부여
//
// 일반 탑(compute.ts) 과 다른 점:
//   - start 는 항상 F1 (체크포인트 / startFloor 옵션 없음).
//   - 마일스톤 보상 없음.
//   - 보스 드롭(룬/토큰) 없음.
//   - 자동 진행 없음 — fight_floor 만.

import {
  TOWER_CHALLENGE_DAILY_ATTEMPTS,
  type TowerChallengeDaily,
  type TowerChallengeProgress,
  type TowerChallengeRun,
  type TowerChallengeState,
} from "@/adventure/tower/challengeTypes";
import { isBossFloor } from "@/adventure/tower/scaling";

export type TowerChallengeAction =
  | { kind: "start" }
  | {
      kind: "fight_floor";
      /** 전투 시뮬레이션 결과 — apply 단계에서 server-derived. */
      outcome: "win" | "lose";
    }
  | { kind: "forfeit" };

export class TowerChallengeError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "TowerChallengeError";
  }
}

export type TowerChallengeComputeInput = {
  state: TowerChallengeState;
  /** 현재 KST 날짜 키 ("YYYY-MM-DD"). */
  today: string;
};

export type TowerChallengeApplied = {
  kind: TowerChallengeAction["kind"];
  /** start/fight_floor 후의 currentFloor. forfeit 후엔 미정의. */
  currentFloor?: number;
  /** fight_floor 의 결과. */
  outcome?: "win" | "lose";
  /** 보스층 클리어로 갱신된 highestFloor (이번 액션이 갱신했을 때만). */
  newHighestFloor?: number;
  /** F50 보스 클리어로 처음 부여된 칭호 id (이번 클리어로 첫 획득). */
  grantedTitleId?: string;
};

export type TowerChallengeComputeResult = {
  state: TowerChallengeState;
  applied: TowerChallengeApplied;
};

const EMPTY_PROGRESS: TowerChallengeProgress = { highestFloor: 0 };

function todayDaily(today: string, prev: TowerChallengeDaily | null): TowerChallengeDaily {
  if (!prev || prev.date !== today) return { date: today, attempts: 0 };
  return prev;
}

/** start — 일일 캡 검증 + 시도 차감 + run 생성 (F1 고정). */
function computeStart(
  input: TowerChallengeComputeInput,
): TowerChallengeComputeResult {
  const { state, today } = input;
  if (state.run) throw new TowerChallengeError("run_in_progress");
  const daily = todayDaily(today, state.daily);
  if (daily.attempts >= TOWER_CHALLENGE_DAILY_ATTEMPTS) {
    throw new TowerChallengeError("daily_cap_reached");
  }
  const progress = state.progress ?? EMPTY_PROGRESS;
  const run: TowerChallengeRun = {
    currentFloor: 1,
    startedAt: Date.now(),
  };
  return {
    state: {
      progress,
      run,
      daily: { ...daily, attempts: daily.attempts + 1 },
    },
    applied: { kind: "start", currentFloor: 1 },
  };
}

/** fight_floor — outcome 받아 진행/사망 처리. */
function computeFightFloor(
  input: TowerChallengeComputeInput,
  outcome: "win" | "lose",
): TowerChallengeComputeResult {
  const { state } = input;
  if (!state.run) throw new TowerChallengeError("no_active_run");
  const cleared = state.run.currentFloor;

  if (outcome === "lose") {
    return {
      state: { ...state, run: null },
      applied: { kind: "fight_floor", outcome: "lose", currentFloor: cleared },
    };
  }

  const progress = state.progress ?? EMPTY_PROGRESS;
  const newHighest = cleared > progress.highestFloor ? cleared : progress.highestFloor;

  const nextRun: TowerChallengeRun = {
    ...state.run,
    currentFloor: cleared + 1,
    upcomingEnemy: undefined,
  };

  return {
    state: {
      progress: { highestFloor: newHighest },
      run: nextRun,
      daily: state.daily,
    },
    applied: {
      kind: "fight_floor",
      outcome: "win",
      currentFloor: cleared + 1,
      newHighestFloor: newHighest > progress.highestFloor ? newHighest : undefined,
    },
  };
}

function computeForfeit(
  input: TowerChallengeComputeInput,
): TowerChallengeComputeResult {
  if (!input.state.run) throw new TowerChallengeError("no_active_run");
  return {
    state: { ...input.state, run: null },
    applied: { kind: "forfeit" },
  };
}

export function computeTowerChallengeOutcome(
  input: TowerChallengeComputeInput,
  action: TowerChallengeAction,
): TowerChallengeComputeResult {
  switch (action.kind) {
    case "start":
      return computeStart(input);
    case "fight_floor":
      return computeFightFloor(input, action.outcome);
    case "forfeit":
      return computeForfeit(input);
  }
}

/** 도전 모드에서 보스층 클리어인지 — apply.ts 가 칭호 분기 결정용. */
export function isChallengeBossClear(
  applied: TowerChallengeApplied,
  clearedFloor: number,
): boolean {
  return (
    applied.kind === "fight_floor" &&
    applied.outcome === "win" &&
    isBossFloor(clearedFloor)
  );
}

export { todayKey } from "@/adventure/tower/dailyKey";
