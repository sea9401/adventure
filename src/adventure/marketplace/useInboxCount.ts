"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchInbox } from "./api";

const POLL_INTERVAL_MS = 60_000;

// 우편함 미수령 카운트 — 배지 표시용. 최초 1회 + 1분 폴링.
// 페이지 visibility 가 hidden 이면 폴링 멈춤 (백그라운드 비용 절약).
export function useInboxCount() {
  const [count, setCount] = useState<number | null>(null);
  const inFlight = useRef(false);
  // 언마운트 후에 in-flight fetch 가 resolve 돼도 setState 가 안 돌게 가드.
  // (현재 앱 수명 내내 살아 있어 실제 누수는 거의 없지만 패턴을 맞춘다.)
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const r = await fetchInbox();
      if (mountedRef.current) setCount(r.unclaimedCount);
    } catch {
      // 네트워크 오류는 무시 — 다음 폴링 또는 수동 새로고침에서 회복.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
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
      mountedRef.current = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { count, refresh };
}
