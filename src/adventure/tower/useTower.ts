"use client";

import { useCallback, useState } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import type { BattleState } from "@/adventure/battle/engine";
import {
  TOWER_STORAGE_KEY,
  type TowerState,
} from "./types";

const EMPTY_STATE: TowerState = {
  progress: { highestFloor: 0, claimedMilestones: [] },
  run: null,
  daily: null,
};

export type TowerApiAction =
  | { kind: "start" }
  | { kind: "fight_floor" }
  | { kind: "forfeit" };

export type TowerApiResponse = {
  ok: boolean;
  tower?: TowerState;
  /** 마일스톤 보상으로 갱신된 character.v2. */
  character?: { gold?: number; [k: string]: unknown };
  /** 마일스톤 보상으로 갱신된 inventory.v2. */
  inventory?: { materials?: Record<string, number>; [k: string]: unknown };
  applied?: {
    kind: string;
    currentFloor?: number;
    outcome?: "win" | "lose";
    newHighestFloor?: number;
    milestone?: { floor: number; reward: { gold?: number; materials?: { id: string; count: number }[] } };
  };
  /** fight_floor 응답에 동봉되는 서버 측 전투 결과. */
  battle?: {
    finalState: BattleState;
    enemyName: string;
    isBoss: boolean;
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
    forfeit: useCallback(() => call({ kind: "forfeit" }), [call]),
  };
}
