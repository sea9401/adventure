"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 30_000;

// 게임 접속 중 주기적으로 /api/presence 에 ping → presence.last_seen_at 갱신.
// 이름/직업/칭호가 바뀌면 다음 ping 에 새 값으로 upsert. 빈 이름/직업이면 ping 생략.
export function usePresenceHeartbeat({
  name,
  className,
  title,
}: {
  name: string;
  className: string;
  title?: string | null;
}) {
  useEffect(() => {
    if (!name || !className) return;
    let cancelled = false;
    const ping = () => {
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, className, title: title ?? null }),
        keepalive: true,
      }).catch(() => {
        // 네트워크 오류는 다음 주기에 자동 재시도.
      });
    };
    ping();
    const id = setInterval(() => {
      if (!cancelled) ping();
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [name, className, title]);
}
