"use client";

// /api/pvp/status 페이지 데이터 fetch + 도전 mutation. ArenaView 에서 사용.

import { useCallback, useState } from "react";
import { useAsyncData } from "@/lib/useAsyncData";

export type ArenaSeason = {
  id: string;
  startAt: string;
  endAt: string;
};

export type ArenaMe = {
  rating: number;
  wins: number;
  losses: number;
  draws: number;
};

export type ArenaLeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  mine: boolean;
};

export type ArenaRecentMatch = {
  id: number;
  createdAt: string;
  iAmAttacker: boolean;
  opponent: { userId: string; name: string };
  myOutcome: "win" | "loss" | "draw";
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
};

export type ArenaStatusResponse = {
  season: ArenaSeason;
  me: ArenaMe;
  top: ArenaLeaderboardEntry[];
  recent: ArenaRecentMatch[];
};

export type ChallengeResponse = {
  seasonId: string;
  outcome: "a_win" | "d_win" | "draw";
  turns: number;
  me: { name: string; ratingBefore: number; ratingAfter: number };
  opponent: {
    userId: string;
    name: string;
    ratingBefore: number;
    ratingAfter: number;
  };
  log: { kind: string; text: string }[];
};

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

export function useArena() {
  const { data, loading, error, refetch } = useAsyncData<ArenaStatusResponse>(
    (signal) => getJson("/api/pvp/status", signal),
    [],
    { errorMessage: "아레나 정보를 불러오지 못했습니다." },
  );

  const [challenging, setChallenging] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ChallengeResponse | null>(null);

  const challenge = useCallback(async (): Promise<ChallengeResponse | null> => {
    setChallenging(true);
    setChallengeError(null);
    try {
      const r = await fetch("/api/pvp/challenge", { method: "POST" });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        const msg =
          r.status === 503
            ? "도전 가능한 상대를 찾지 못했어요."
            : r.status === 400
              ? "내 캐릭터 정보를 읽을 수 없어요."
              : `도전 실패 (HTTP ${r.status}${body ? `: ${body}` : ""})`;
        setChallengeError(msg);
        return null;
      }
      const result = (await r.json()) as ChallengeResponse;
      setLastResult(result);
      refetch();
      return result;
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : "도전 실패");
      return null;
    } finally {
      setChallenging(false);
    }
  }, [refetch]);

  return {
    status: data,
    loading,
    error,
    refetch,
    challenge,
    challenging,
    challengeError,
    lastResult,
    clearLastResult: () => setLastResult(null),
  };
}
