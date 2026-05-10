"use client";

import { useEffect, useState } from "react";

// 개인 metric 3종 + 길드 누적 명성 1종.
export type RankingMetric = "level" | "fame" | "battleCount" | "guild";

export type RankingEntry = {
  rank: number;
  name: string;
  level: number;
  fame: number;
  battleCount: number;
  mine: boolean;
};

export type RankingMe = {
  rank: number;
  name: string;
  level: number;
  fame: number;
  battleCount: number;
};

export type GuildRankingEntry = {
  rank: number;
  name: string;
  fameTotal: number;
  memberCount: number;
  grade: string;
  mine: boolean;
};

export type GuildRankingMe = {
  rank: number;
  name: string;
  fameTotal: number;
  memberCount: number;
  grade: string;
};

type RankingsResponse = {
  list: RankingEntry[];
  me: RankingMe | null;
};

type GuildRankingsResponse = {
  list: GuildRankingEntry[];
  me: GuildRankingMe | null;
};

// 랭킹 데이터 fetch — 서버가 닉네임 보유 유저 전체에서 derive 해 정렬한 결과를 받는다.
// 본인 등록 액션은 없음 (자동 포함).
export function useRankings(metric: RankingMetric) {
  const [list, setList] = useState<RankingEntry[] | null>(null);
  const [me, setMe] = useState<RankingMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (metric === "guild") {
      // 길드 랭킹은 별도 훅으로 페치 — 이 훅은 개인 랭킹만 다룸.
      return;
    }
    let cancelled = false;
    // 데이터 fetch 라이프사이클 — loading/error 는 비동기 응답까지 살아있는 외부 상태 동기화.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/rankings?metric=${metric}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as RankingsResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setList(data.list);
        setMe(data.me);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "랭킹을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [metric]);

  return { list, me, loading, error };
}

export function useGuildRankings(active: boolean) {
  const [list, setList] = useState<GuildRankingEntry[] | null>(null);
  const [me, setMe] = useState<GuildRankingMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch("/api/rankings/guilds")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as GuildRankingsResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setList(data.list);
        setMe(data.me);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "길드 랭킹을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { list, me, loading, error };
}
