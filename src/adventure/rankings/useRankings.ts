"use client";

import { useCallback, useEffect, useState } from "react";

export type RankingMetric = "level" | "fame" | "battleCount";

export type RankingEntry = {
  rank: number;
  name: string;
  level: number;
  fame: number;
  battleCount: number;
  mine: boolean;
};

export type MeStatus =
  | { registered: false }
  | {
      registered: true;
      name: string;
      level: number;
      fame: number;
      battleCount: number;
      updatedAt: string;
    };

// 랭킹 데이터 fetch + 본인 등록 상태 관리. 마운트/metric 변화 시마다 fetch.
// register/leave 후엔 두 쿼리 모두 invalidate.
export function useRankings(metric: RankingMetric) {
  const [list, setList] = useState<RankingEntry[] | null>(null);
  const [me, setMe] = useState<MeStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    try {
      const r = await fetch(`/api/rankings?metric=${metric}&limit=100`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setList((await r.json()) as RankingEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "랭킹을 불러오지 못했습니다.");
    }
  }, [metric]);

  const fetchMe = useCallback(async () => {
    try {
      const r = await fetch("/api/rankings/me");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setMe((await r.json()) as MeStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "본인 상태 조회 실패");
    }
  }, []);

  useEffect(() => {
    // 데이터 fetch 라이프사이클 — loading/error 는 비동기 응답까지 살아있는 외부 상태 동기화.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    void Promise.all([fetchList(), fetchMe()]).finally(() => setLoading(false));
  }, [fetchList, fetchMe]);

  // 등록/갱신. 현재 character 의 스냅샷을 서버로 전송.
  const register = useCallback(
    async (snapshot: {
      name: string;
      level: number;
      fame: number;
      battleCount: number;
    }) => {
      setError(null);
      try {
        const r = await fetch("/api/rankings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await Promise.all([fetchList(), fetchMe()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "등록 실패");
      }
    },
    [fetchList, fetchMe],
  );

  const leave = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/rankings", { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await Promise.all([fetchList(), fetchMe()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  }, [fetchList, fetchMe]);

  return { list, me, loading, error, register, leave };
}
