"use client";

import { useCallback, useState } from "react";
import { useRemoteSave, useSavedValue } from "@/lib/storage/SaveProvider";
import type { BattleState } from "@/adventure/battle/engine";
import {
  TOWER_CHALLENGE_STORAGE_KEY,
  type TowerChallengeState,
} from "./challengeTypes";

const EMPTY_STATE: TowerChallengeState = {
  progress: { highestFloor: 0 },
  run: null,
  daily: null,
};

export type TowerChallengeApiAction =
  | { kind: "start" }
  | { kind: "fight_floor" }
  | { kind: "forfeit" };

export type TowerChallengeApiResponse = {
  ok: boolean;
  challenge?: TowerChallengeState;
  applied?: {
    kind: string;
    currentFloor?: number;
    outcome?: "win" | "lose";
    newHighestFloor?: number;
    /** F50 보스 클리어로 부여된 칭호 id (이번 클리어로 첫 획득). */
    grantedTitleId?: string;
  };
  battle?: {
    finalState: BattleState;
    enemyName: string;
    isBoss: boolean;
  };
  error?: string;
};

// 고탑 도전 모드 상태 훅 — savesKv 의 tower-challenge.v1 을 hydrate.
// useTower 의 부분집합 — 자동 진행 / 마일스톤 / 드롭 없음. 칭호 부여는 grantedTitleId 로 통보.
export function useTowerChallenge(opts?: {
  /** F50 칭호가 새로 부여됐을 때 호출 — 부모에서 adventure-log.v2 동기화. */
  onApplied?: (response: TowerChallengeApiResponse) => void;
}) {
  const initial = useSavedValue<TowerChallengeState>(TOWER_CHALLENGE_STORAGE_KEY);
  const [state, setState] = useState<TowerChallengeState>(initial ?? EMPTY_STATE);
  const [pending, setPending] = useState<TowerChallengeApiAction["kind"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remote = useRemoteSave();

  const call = useCallback(
    async (action: TowerChallengeApiAction): Promise<TowerChallengeApiResponse> => {
      setPending(action.kind);
      setError(null);
      try {
        await remote.flush();
        const res = await fetch("/api/tower/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const data = (await res.json()) as TowerChallengeApiResponse;
        if (!data.ok) {
          setError(data.error ?? "unknown");
          return data;
        }
        if (data.challenge) setState(data.challenge);
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
    [opts, remote],
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
