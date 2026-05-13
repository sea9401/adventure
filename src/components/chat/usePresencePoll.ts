"use client";

import { useEffect, useState } from "react";
import { fetchPresence, type PresenceUser } from "./chatApi";

// 접속자 목록은 "지금 누가 있나" 정도라 3초 갱신은 과도 — 10초면 충분.
// 폴마다 presence 테이블 시간윈도우 스캔이 돌므로 빈도가 곧 부하.
const PRESENCE_POLL_MS = 10000;

// 패널이 열려 있는 동안 접속자 목록을 주기적으로 폴링. 닫히면 폴링 중단.
export function usePresencePoll(open: boolean): PresenceUser[] {
  const [presence, setPresence] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await fetchPresence();
        // 한글 가나다순으로 고정 — 서버가 매번 다른 순서로 줘도 화면은 안정적.
        next.sort((a, b) => a.name.localeCompare(b.name, "ko"));
        if (!cancelled) setPresence(next);
      } catch {
        // 네트워크 오류는 다음 폴링에서 자동 재시도 — UI 에 띄우지 않음.
      }
    };
    tick();
    const interval = setInterval(tick, PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open]);

  return presence;
}
