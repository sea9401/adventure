"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatCircle } from "@phosphor-icons/react";
import { ChatPanel, type ChatMessage } from "./ChatPanel";

const POLL_INTERVAL_MS = 3000;
const LAST_SEEN_KEY = "chat:lastSeenId";

async function fetchMessages(): Promise<ChatMessage[]> {
  const res = await fetch("/api/chat", { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json();
}

function readLastSeen(): number {
  if (typeof window === "undefined") return 0;
  const v = window.localStorage.getItem(LAST_SEEN_KEY);
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function writeLastSeen(id: number) {
  window.localStorage.setItem(LAST_SEEN_KEY, String(id));
}

export function ChatButton({
  name,
  className,
  title,
  onSent,
}: {
  name: string;
  className: string;
  title: string | null;
  /** 메시지 전송 성공 시 1회 호출 — '수다쟁이' 칭호 카운터 등에 사용. */
  onSent?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastSeenId, setLastSeenId] = useState<number>(readLastSeen);

  // 패널이 닫혀 있어도 항상 폴링 — 새 메시지 도착 감지용.
  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    const tick = async () => {
      try {
        const next = await fetchMessages();
        if (cancelled) return;
        setMessages(next);
        if (!initialized) {
          initialized = true;
          // 한 번도 채팅을 본 적 없는 유저(lastSeenId === 0) 라면, 첫 폴링 결과의
          // 최신 id 로 점프시켜서 옛 메시지를 모두 unread 로 표시하지 않게 한다.
          setLastSeenId((prev) => {
            if (prev !== 0 || next.length === 0) return prev;
            const latest = next[next.length - 1].id;
            writeLastSeen(latest);
            return latest;
          });
        }
      } catch {
        // 네트워크 오류는 다음 폴링에서 자동 재시도.
      }
    };
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // 패널이 열려 있는 동안 도착하는 메시지는 즉시 읽은 것으로 처리.
  useEffect(() => {
    if (!open || messages.length === 0) return;
    const latest = messages[messages.length - 1].id;
    setLastSeenId((prev) => {
      if (latest <= prev) return prev;
      writeLastSeen(latest);
      return latest;
    });
  }, [open, messages]);

  const handleMessageSent = useCallback(
    (m: ChatMessage) => {
      setMessages((prev) =>
        prev.some((x) => x.id === m.id) ? prev : [...prev, m],
      );
      onSent?.();
    },
    [onSent],
  );

  const hasUnread = messages.some((m) => m.id > lastSeenId && !m.mine);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hasUnread ? "전체 채팅 열기 (새 메시지 있음)" : "전체 채팅 열기"}
        title="전체 채팅"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <ChatCircle size={20} weight="duotone" />
        {hasUnread && (
          <span
            aria-hidden
            className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950"
          />
        )}
      </button>
      <ChatPanel
        open={open}
        onClose={() => setOpen(false)}
        name={name}
        className={className}
        title={title}
        messages={messages}
        onMessageSent={handleMessageSent}
      />
    </>
  );
}
