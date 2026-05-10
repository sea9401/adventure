"use client";

import { useEffect, useState } from "react";

export type RankingMetric = "level" | "fame" | "battleCount";

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

type RankingsResponse = {
  list: RankingEntry[];
  me: RankingMe | null;
};

// 랭킹 데이터 fetch — 서버가 닉네임 보유 유저 전체에서 derive 해 정렬한 결과를 받는다.
// 본인 등록 액션은 없음 (자동 포함).
export function useRankings(metric: RankingMetric) {
  const [list, setList] = useState<RankingEntry[] | null>(null);
  const [me, setMe] = useState<RankingMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
