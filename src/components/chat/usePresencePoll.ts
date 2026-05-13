"use client";

import { useEffect, useState } from "react";
import { fetchPresence, type PresenceUser } from "./chatApi";

const PRESENCE_POLL_MS = 3000;

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
