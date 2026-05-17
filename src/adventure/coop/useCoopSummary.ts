"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CoopSummaryRegion,
  CoopSummaryResponse,
} from "@/app/api/coop/summary/route";

// QuickTravel 같이 여러 coop region 의 상태를 동시에 보여주는 화면용.
// CoopBossCard 의 무거운 useCoopBoss (region 1개 × 6~9 query) 대신 batched 1 fetch.
// 폴 주기는 카드 폴(10s) 보다 살짝 길게 — 빠른 이동 화면은 보통 잠깐만 머무는 곳.

const POLL_INTERVAL_MS = 15_000;

export function useCoopSummary(enabled: boolean) {
  const [regions, setRegions] = useState<CoopSummaryRegion[] | null>(null);
  const cancelledRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    try {
      const r = await fetch("/api/coop/summary");
      if (!r.ok) return;
      const json = (await r.json()) as CoopSummaryResponse;
      if (!cancelledRef.current) setRegions(json.regions);
    } catch {
      // 빠른 이동 화면 보조 정보 — 실패 시 뱃지 없이 노출, 별도 에러 UI 안 띄움.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    cancelledRef.current = false;
    void fetchOnce();
    const id = setInterval(() => void fetchOnce(), POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, [enabled, fetchOnce]);

  return regions;
}
