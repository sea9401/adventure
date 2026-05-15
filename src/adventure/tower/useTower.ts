"use client";

import { useCallback, useState } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import type { BattleState } from "@/adventure/battle/engine";
import {
  TOWER_STORAGE_KEY,
  type TowerState,
} from "./types";
import type { BossClearReward } from "./runeDrops";
import type { RuneGrade, RuneId } from "@/adventure/data/runes";

const EMPTY_STATE: TowerState = {
  progress: { highestFloor: 0, claimedMilestones: [] },
  run: null,
  daily: null,
};

export type TowerApiAction =
  | { kind: "start" }
  | { kind: "fight_floor" }
  | { kind: "fight_floors_auto" }
  | { kind: "forfeit" };

type MilestoneReward = {
  gold?: number;
  materials?: { id: string; count: number }[];
};

export type TowerApiResponse = {
  ok: boolean;
  tower?: TowerState;
  /** 마일스톤 보상으로 갱신된 character.v2. */
  character?: { gold?: number; [k: string]: unknown };
  /** 마일스톤·드롭으로 갱신된 inventory.v2. runes 도 포함. */
  inventory?: {
    materials?: Record<string, number>;
    runes?: Partial<Record<RuneId, Partial<Record<RuneGrade, number>>>>;
    [k: string]: unknown;
  };
  applied?: {
    kind: string;
    currentFloor?: number;
    outcome?: "win" | "lose";
    newHighestFloor?: number;
    milestone?: { floor: number; reward: MilestoneReward };
    /** 보스층 클리어 시 굴려진 룬·토큰 드롭. */
    bossDrops?: { floor: number; reward: BossClearReward };
  };
  /** fight_floor / fight_floors_auto 응답에 동봉되는 서버 측 전투 결과 (마지막 전투). */
  battle?: {
    finalState: BattleState;
    enemyName: string;
    isBoss: boolean;
  };
  /** fight_floors_auto 응답 전용 — 묶음 진행 요약. */
  auto?: {
    startFloor: number;
    endFloor: number;
    floorsCleared: number;
    reason: "next_is_boss" | "revive_used" | "death";
    milestones: { floor: number; reward: MilestoneReward }[];
  };
  error?: string;
};

// 고탑 상태 훅 — savesKv 의 tower.v1 을 hydrate 하고, /api/tower 호출 wrapper 를 제공.
// 서버 응답으로 받은 새 상태를 in-memory 에 반영, 동봉된 character/inventory 도 콜백으로 전파.
export function useTower(opts?: {
  /** 마일스톤 보상으로 character/inventory 가 갱신됐을 때 호출 — 부모에서 in-memory state 동기화. */
  onApplied?: (response: TowerApiResponse) => void;
}) {
  const initial = useSavedValue<TowerState>(TOWER_STORAGE_KEY);
  const [state, setState] = useState<TowerState>(initial ?? EMPTY_STATE);
  const [pending, setPending] = useState<TowerApiAction["kind"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (action: TowerApiAction): Promise<TowerApiResponse> => {
      setPending(action.kind);
      setError(null);
      try {
        const res = await fetch("/api/tower", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const data = (await res.json()) as TowerApiResponse;
        if (!data.ok) {
          setError(data.error ?? "unknown");
          return data;
        }
        if (data.tower) setState(data.tower);
        opts?.onApplied?.(data);
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "network";
        setError(msg);
        return { ok: false, error: msg };
      } finally {
        setPending(null);
      }
    },
    [opts],
  );

  return {
    state,
    pending,
    error,
    start: useCallback(() => call({ kind: "start" }), [call]),
    fightFloor: useCallback(() => call({ kind: "fight_floor" }), [call]),
    fightFloorsAuto: useCallback(
      () => call({ kind: "fight_floors_auto" }),
      [call],
    ),
    forfeit: useCallback(() => call({ kind: "forfeit" }), [call]),
  };
}
