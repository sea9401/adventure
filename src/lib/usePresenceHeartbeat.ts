"use client";

import { useEffect } from "react";
import { APP_BUILD_VERSION } from "./clientVersion";

const HEARTBEAT_INTERVAL_MS = 30_000;

// 한 세션 안에서 단 한 번만 reload — 신호 받자마자 location.reload 가 일어나니
// race 로 여러 번 발화될 일은 없지만 방어용.
let reloadFired = false;

// 게임 접속 중 주기적으로 /api/presence 에 ping → presence.last_seen_at 갱신.
// 이름/직업/칭호가 바뀌면 다음 ping 에 새 값으로 upsert. 빈 이름/직업이면 ping 생략.
// 응답에 동봉된 buildVersion 이 baked-in 과 다르면 옛 JS → 강제 reload (=새 deploy
// 적용. 단일 세션 enforce 같은 클라이언트/서버 contract 변경 즉시 전파용).
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
    const ping = async () => {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, className, title: title ?? null }),
          keepalive: true,
        });
        if (cancelled || !res.ok) return;
        try {
          const body = (await res.json()) as { buildVersion?: string };
          if (
            !reloadFired &&
            typeof body.buildVersion === "string" &&
            body.buildVersion !== APP_BUILD_VERSION &&
            typeof window !== "undefined"
          ) {
            reloadFired = true;
            try {
              localStorage.setItem(
                "pending-reload-toast.v1",
                "최신 버전으로 새로 불러왔습니다.",
              );
            } catch {}
            window.location.reload();
          }
        } catch {
          // 응답 본문이 옛 형식 (204) 일 수 있음 — ignore.
        }
      } catch {
        // 네트워크 오류는 다음 주기에 자동 재시도.
      }
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
