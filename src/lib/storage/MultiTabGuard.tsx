"use client";

import { useEffect, useState } from "react";

// 같은 브라우저 안에서 게임이 여러 탭에 열린 경우 — 가장 오래된 탭만 활성, 나머지는 블로킹 모달.
// BroadcastChannel API 로 탭 간 통신. 다른 디바이스/브라우저는 이걸로 못 잡음 (그쪽은
// DB 사이드 stale 가드 + presence heartbeat 으로 별도 처리).
//
// 프로토콜:
//   1. 마운트 시 sessionId (timestamp prefix + random suffix) 생성, "claim" 브로드캐스트.
//   2. 다른 탭의 "claim" 수신 시:
//      - 그쪽 id 가 우리보다 작으면 (= 더 오래됨) → 우리가 newer → 모달.
//      - 그쪽 id 가 우리보다 크면 (= 더 새로움) → 우리 claim 재방송 (그쪽이 우리를 알도록).
//   3. pagehide / unmount 시 "bye" 브로드캐스트.
//   4. blocked 상태에서 "bye" 수신 → re-claim 사이클 (다른 활성 탭이 또 있을 수 있음).

const CHANNEL_NAME = "adventure-game-session";

type ClaimMsg = { type: "claim"; id: string };
type ByeMsg = { type: "bye"; id: string };
type Msg = ClaimMsg | ByeMsg;

function makeSessionId(): string {
  // timestamp 13 자리 zero-pad → 사전식 비교가 곧 시간순 비교.
  const ts = Date.now().toString().padStart(13, "0");
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}`;
}

export function useMultiTabGuard() {
  const [isDuplicate, setIsDuplicate] = useState(false);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const sessionId = makeSessionId();
    const channel = new BroadcastChannel(CHANNEL_NAME);
    let blocked = false;

    const broadcast = (msg: Msg) => {
      try {
        channel.postMessage(msg);
      } catch {
        // 채널이 닫혔거나 오류 — 무시.
      }
    };

    const handler = (event: MessageEvent) => {
      const data = event.data as Msg | undefined;
      if (!data || typeof data !== "object") return;
      if (data.type === "claim") {
        if (data.id === sessionId) return;
        if (data.id < sessionId) {
          // 그쪽이 더 오래됨 → 우리가 duplicate.
          if (!blocked) {
            blocked = true;
            setIsDuplicate(true);
          }
        } else {
          // 우리가 더 오래됨 → 우리 존재를 그쪽에게 알림.
          broadcast({ type: "claim", id: sessionId });
        }
      } else if (data.type === "bye") {
        if (blocked) {
          // 누군가 떠남 — 재협상. 다른 활성 탭이 또 있으면 다시 blocked 됨.
          blocked = false;
          setIsDuplicate(false);
          broadcast({ type: "claim", id: sessionId });
        }
      }
    };

    channel.addEventListener("message", handler);
    broadcast({ type: "claim", id: sessionId });

    const onPageHide = () => broadcast({ type: "bye", id: sessionId });
    window.addEventListener("pagehide", onPageHide);

    return () => {
      channel.removeEventListener("message", handler);
      window.removeEventListener("pagehide", onPageHide);
      broadcast({ type: "bye", id: sessionId });
      channel.close();
    };
  }, []);

  return { isDuplicate };
}

export function MultiTabOverlay() {
  const { isDuplicate } = useMultiTabGuard();
  if (!isDuplicate) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-6">
      <div className="max-w-sm rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          다른 탭에서 게임이 열려 있습니다
        </div>
        <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          데이터 충돌을 막기 위해 한 번에 한 탭에서만 진행할 수 있습니다.
          <br />이 창을 닫고 기존 탭에서 계속하거나, 기존 탭을 닫고 이 창을 새로고침해 주세요.
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
