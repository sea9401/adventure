"use client";

import { useEffect, useRef, useState } from "react";
import { ChatCircle, PaperPlaneTilt, X } from "@phosphor-icons/react";
import { formatRelative } from "@/lib/notifications";

type ChatMessage = {
  id: number;
  name: string;
  className: string;
  content: string;
  createdAt: number;
  mine: boolean;
};

const POLL_INTERVAL_MS = 3000;
const MAX_LENGTH = 200;

async function fetchMessages(): Promise<ChatMessage[]> {
  const res = await fetch("/api/chat", { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json();
}

async function postMessage(payload: {
  name: string;
  className: string;
  content: string;
}): Promise<ChatMessage> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `post failed: ${res.status}`);
  }
  return res.json();
}

export function ChatPanel({
  open,
  onClose,
  name,
  className,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  className: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await fetchMessages();
        if (!cancelled) setMessages(next);
      } catch {
        // 네트워크 오류는 다음 폴링에서 자동 재시도 — UI 에 띄우지 않음.
      }
    };
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open]);

  // 새 메시지가 추가되면 자동 스크롤 (이미 하단 근처에 있을 때만).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const sent = await postMessage({ name, className, content: trimmed });
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      setDraft("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "전송 실패";
      setError(
        msg === "rate limited"
          ? "너무 빨라요 (2초 후 다시 시도)"
          : "전송 실패",
      );
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/40 sm:items-end sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-md flex-col bg-white shadow-2xl dark:bg-zinc-950 sm:h-[600px] sm:max-h-[85vh] sm:rounded-lg sm:border sm:border-zinc-200 dark:sm:border-zinc-800">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <ChatCircle size={20} weight="duotone" />
            전체 채팅
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="채팅 닫기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </header>

        <div
          ref={listRef}
          className="flex-1 space-y-2 overflow-y-auto px-3 py-2"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
              아직 메시지가 없습니다.
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col gap-0.5 ${m.mine ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {m.className}
                  </span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                    {m.name}
                  </span>
                  <span>{formatRelative(m.createdAt)}</span>
                </div>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-sm ${
                    m.mine
                      ? "bg-blue-500 text-white"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
        </div>

        {error && (
          <div className="border-t border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <form
          onSubmit={submit}
          className="flex items-center gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_LENGTH}
            placeholder="메시지를 입력하세요"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="전송"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </button>
        </form>
      </div>
    </div>
  );
}
