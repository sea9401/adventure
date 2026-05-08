"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchInbox } from "./api";

const POLL_INTERVAL_MS = 60_000;

// 우편함 미수령 카운트 — 배지 표시용. 최초 1회 + 1분 폴링.
// 페이지 visibility 가 hidden 이면 폴링 멈춤 (백그라운드 비용 절약).
export function useInboxCount() {
  const [count, setCount] = useState<number | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const r = await fetchInbox();
      setCount(r.unclaimedCount);
    } catch {
      // 네트워크 오류는 무시 — 다음 폴링 또는 수동 새로고침에서 회복.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // 비동기 fetch 후 setState 라 cascading render 가 아니지만 린트는 호출
    // 그래프만 보고 발화하므로 끔.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh();
    };
    const id = setInterval(tick, POLL_INTERVAL_MS);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { count, refresh };
}
