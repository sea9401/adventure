// 고탑 서버측 순수 계산 — shop.ts 패턴을 따른다.
// 액션 처리는 두 단계로 분리:
//   1) 이 파일의 순수 함수: 입력 상태 + 액션 + 결정된 전투 결과(outcome) → 새 상태/적용 결과
//   2) apply.ts: DB 트랜잭션 + 실제 전투 simulation(server battle) + 결과 적용
// 분리 이유: 1) 단위 테스트 용이, 2) 액션 검증 로직과 battle 의존성 분리.

import {
  TOWER_DAILY_ATTEMPTS,
  type TowerDaily,
  type TowerProgress,
  type TowerRun,
  type TowerState,
} from "@/adventure/tower/types";
import {
  availableStartFloors,
  isBossFloor,
  startFloorAfterCheckpoint,
} from "@/adventure/tower/scaling";
import { milestoneFor, type TowerMilestoneReward } from "@/adventure/tower/rewards";
import type { BossClearReward } from "@/adventure/tower/runeDrops";

export type TowerAction =
  | {
      kind: "start";
      /**
       * 선택한 시작층. 미동봉이면 기존 동작(체크포인트 직후부터).
       * 검증: availableStartFloors(highestFloor) 안에 있어야 함. 아니면 invalid_start_floor.
       */
      startFloor?: number;
    }
  | {
      kind: "fight_floor";
      /** 전투 시뮬레이션 결과 — apply 단계에서 server-derived. */
      outcome: "win" | "lose";
    }
  | { kind: "forfeit" };

// shop.ts 의 ShopError 와 동일한 의도 — 모두 게임 규칙 위반(400).
export class TowerError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "TowerError";
  }
}

export type TowerComputeInput = {
  state: TowerState;
  /** 현재 KST 날짜 키 ("YYYY-MM-DD"). 일일 캡 비교용. */
  today: string;
};

export type TowerApplied = {
  /** 적용된 액션 종류. apply.ts 의 fight_floors_auto 묶음 결과는 같은 필드를 쓰되 별도 kind. */
  kind: TowerAction["kind"] | "fight_floors_auto";
  /** start/fight_floor 후의 currentFloor. forfeit 후엔 미정의. */
  currentFloor?: number;
  /** fight_floor 의 결과 (win/lose). */
  outcome?: "win" | "lose";
  /** 보스층 클리어로 갱신된 highestFloor (이번 액션이 갱신했을 때만). */
  newHighestFloor?: number;
  /** 보스층 첫 도달로 수령한 마일스톤 보상. 없으면 미정의. */
  milestone?: { floor: number; reward: TowerMilestoneReward };
  /**
   * 보스층 클리어 시 매번 굴리는 룬·토큰 드롭. 마일스톤(첫 도달 한정)과 별개.
   * apply.ts 가 rollBossClearReward 로 채우고, 인벤 적용도 apply 단계.
   */
  bossDrops?: { floor: number; reward: BossClearReward };
};

export type TowerComputeResult = {
  state: TowerState;
  applied: TowerApplied;
};

const EMPTY_PROGRESS: TowerProgress = { highestFloor: 0, claimedMilestones: [] };

function todayDaily(today: string, prev: TowerDaily | null): TowerDaily {
  if (!prev || prev.date !== today) return { date: today, attempts: 0 };
  return prev;
}

/** start — 일일 캡 검증 + 시도 차감 + run 생성. 이미 진행 중인 run 있으면 in_progress. */
function computeStart(
  input: TowerComputeInput,
  action: Extract<TowerAction, { kind: "start" }>,
): TowerComputeResult {
  const { state, today } = input;
  if (state.run) throw new TowerError("run_in_progress");
  const daily = todayDaily(today, state.daily);
  if (daily.attempts >= TOWER_DAILY_ATTEMPTS) {
    throw new TowerError("daily_cap_reached");
  }
  const progress = state.progress ?? EMPTY_PROGRESS;
  const allowed = availableStartFloors(progress.highestFloor);
  let startFloor: number;
  if (action.startFloor === undefined) {
    // 미지정 — 기존 동작(가장 높은 체크포인트) 유지. 첫 시도면 F1.
    startFloor = startFloorAfterCheckpoint(progress.highestFloor);
  } else {
    if (!allowed.includes(action.startFloor)) {
      throw new TowerError("invalid_start_floor");
    }
    startFloor = action.startFloor;
  }
  const run: TowerRun = {
    currentFloor: startFloor,
    startedAt: Date.now(),
    reviveAvailable: true,
  };
  return {
    state: {
      progress,
      run,
      daily: { ...daily, attempts: daily.attempts + 1 },
    },
    applied: { kind: "start", currentFloor: startFloor },
  };
}

/**
 * fight_floor — outcome 을 받아 진행/사망 처리.
 * 호출자(apply.ts)가 실제 전투를 돌리고 win/lose 를 결정한 뒤 이 함수를 호출한다.
 */
function computeFightFloor(
  input: TowerComputeInput,
  outcome: "win" | "lose",
): TowerComputeResult {
  const { state } = input;
  if (!state.run) throw new TowerError("no_active_run");
  const cleared = state.run.currentFloor;

  if (outcome === "lose") {
    // 사망 — run 종료. progress / daily 는 변동 없음. 다음 시도는 체크포인트부터.
    return {
      state: { ...state, run: null },
      applied: { kind: "fight_floor", outcome: "lose", currentFloor: cleared },
    };
  }

  // 승리 — currentFloor 클리어 → currentFloor + 1 로 이동.
  // 보스층 클리어면 progress.highestFloor 갱신 + 첫 도달 마일스톤 지급.
  const progress = state.progress ?? EMPTY_PROGRESS;
  let newHighest = progress.highestFloor;
  let claimed = progress.claimedMilestones;
  let milestone: TowerApplied["milestone"];

  if (cleared > newHighest) newHighest = cleared;

  if (isBossFloor(cleared) && !progress.claimedMilestones.includes(cleared)) {
    const reward = milestoneFor(cleared);
    if (reward) milestone = { floor: cleared, reward };
    claimed = [...progress.claimedMilestones, cleared];
  }

  const nextRun: TowerRun = {
    ...state.run,
    currentFloor: cleared + 1,
    // 새 층으로 넘어가므로 이전 층의 upcomingEnemy 는 무효 — 비운다. apply.ts 의
    // withUpcomingEnemy 가 새 floor 에 맞는 잡몹을 픽해 다시 채워준다.
    upcomingEnemy: undefined,
  };

  return {
    state: {
      progress: { highestFloor: newHighest, claimedMilestones: claimed },
      run: nextRun,
      daily: state.daily,
    },
    applied: {
      kind: "fight_floor",
      outcome: "win",
      currentFloor: cleared + 1,
      newHighestFloor: newHighest > progress.highestFloor ? newHighest : undefined,
      milestone,
    },
  };
}

/** forfeit — run 즉시 종료. daily 시도 환불 없음 (의도된 정책). */
function computeForfeit(input: TowerComputeInput): TowerComputeResult {
  if (!input.state.run) throw new TowerError("no_active_run");
  return {
    state: { ...input.state, run: null },
    applied: { kind: "forfeit" },
  };
}

export function computeTowerOutcome(
  input: TowerComputeInput,
  action: TowerAction,
): TowerComputeResult {
  switch (action.kind) {
    case "start":
      return computeStart(input, action);
    case "fight_floor":
      return computeFightFloor(input, action.outcome);
    case "forfeit":
      return computeForfeit(input);
  }
}

/**
 * "다음 보스까지 자동" 한 스텝의 순수 규칙.
 *   - 승리: computeFightFloor(win) 적용 후, 다음 currentFloor 가 보스면 reason="next_is_boss" 로 종료.
 *           그렇지 않으면 reason=null 로 루프 계속.
 *   - 패배 + 부활 가능: run.reviveAvailable=false 로 마킹, reason="revive_used" 로 종료. run 자체는 유지.
 *   - 패배 + 부활 없음: computeFightFloor(lose) 적용(run=null), reason="death" 로 종료.
 *
 * apply.ts 의 fight_floors_auto 가 매 전투 결과를 받아 이 함수를 호출하며 누적한다.
 */
export type AutoStepResult = {
  state: TowerState;
  /** 이 스텝이 보스층 첫 도달 마일스톤을 발생시켰으면 동봉. */
  milestone?: { floor: number; reward: TowerMilestoneReward };
  /** null 이면 루프 계속, 그 외 값이면 그 사유로 루프 종료. */
  reason: null | "next_is_boss" | "revive_used" | "death";
};

export function applyAutoStep(
  input: TowerComputeInput,
  outcome: "win" | "lose",
): AutoStepResult {
  const { state } = input;
  if (!state.run) {
    throw new TowerError("no_active_run");
  }

  if (outcome === "win") {
    const next = computeFightFloor(input, "win");
    const nextRun = next.state.run;
    const isNextBoss = nextRun ? isBossFloor(nextRun.currentFloor) : false;
    return {
      state: next.state,
      milestone: next.applied.milestone,
      reason: isNextBoss ? "next_is_boss" : null,
    };
  }

  // 패배.
  if (state.run.reviveAvailable !== false) {
    return {
      state: { ...state, run: { ...state.run, reviveAvailable: false } },
      reason: "revive_used",
    };
  }
  const ended = computeFightFloor(input, "lose");
  return { state: ended.state, reason: "death" };
}

/** "YYYY-MM-DD" — KST 기준. 클라이언트 자정 표시와 일치하도록 +9h. */
export function todayKey(now: Date = new Date()): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
