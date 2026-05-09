"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown, ChatCircle, PaperPlaneTilt, Users, X } from "@phosphor-icons/react";
import { formatRelative } from "@/lib/notifications";
import { CHAT_MAX_LENGTH } from "@/lib/chat-config";
import { DEFAULT_CLASS_NAME } from "@/adventure/character/defaults";
import { SendMessageModal } from "@/adventure/marketplace/SendMessageModal";

export type ChatMessage = {
  id: number;
  name: string;
  className: string;
  title: string | null;
  content: string;
  createdAt: number;
  mine: boolean;
};

type PresenceUser = {
  name: string;
  className: string;
  title: string | null;
  mine: boolean;
};

const PRESENCE_POLL_MS = 3000;

// 서버 (api/chat/route.ts) 가 반환하는 에러 문자열 → 사용자용 한글 메시지.
function translateChatError(msg: string): string {
  if (msg === "rate limited") return "너무 빨라요 (2초 후 다시 시도)";
  if (msg.startsWith("too long")) return "메시지가 너무 깁니다.";
  if (msg === "empty content") return "내용을 입력해주세요.";
  if (msg === "unauthorized") return "로그인이 만료됐습니다. 새로고침 해주세요.";
  if (msg === "invalid json" || msg.startsWith("missing ")) return "요청 형식이 잘못됐습니다.";
  return "전송 실패";
}

async function fetchPresence(): Promise<PresenceUser[]> {
  const res = await fetch("/api/presence", { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json();
}

async function postMessage(payload: {
  name: string;
  className: string;
  title: string | null;
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
  title,
  messages,
  onMessageSent,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  className: string;
  title: string | null;
  messages: ChatMessage[];
  onMessageSent: (m: ChatMessage) => void;
}) {
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pmTarget, setPmTarget] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await fetchPresence();
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

  // 패널을 처음 열었을 때 한 번은 무조건 맨 아래로 — 최신 메시지부터 보이게.
  // open 이 false 가 되면 다음 열림에 다시 한 번 트리거되도록 ref 리셋.
  const initialScrolledRef = useRef(false);
  useEffect(() => {
    if (!open) initialScrolledRef.current = false;
  }, [open]);

  // 새 메시지가 추가되면 자동 스크롤 (이미 하단 근처에 있을 때만).
  // 단, open 직후 첫 메시지 도착 시점엔 강제로 맨 아래로 한 번 정렬.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (open && !initialScrolledRef.current && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
      initialScrolledRef.current = true;
      return;
    }
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const sent = await postMessage({ name, className, title, content: trimmed });
      onMessageSent(sent);
      setDraft("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(translateChatError(msg));
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end justify-end bg-black/40 sm:items-end sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[100dvh] w-full max-w-md flex-col bg-white shadow-2xl dark:bg-zinc-950 sm:h-[600px] sm:max-h-[85vh] sm:rounded-lg sm:border sm:border-zinc-200 dark:sm:border-zinc-800"
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <ChatCircle size={20} weight="duotone" />
            전체 채팅
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPresenceOpen((v) => !v)}
              aria-expanded={presenceOpen}
              aria-label="접속자 목록"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Users size={14} weight="duotone" />
              <span className="tabular-nums">접속 {presence.length}명</span>
              <CaretDown
                size={12}
                weight="bold"
                className={`transition-transform ${presenceOpen ? "rotate-180" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="채팅 닫기"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {presenceOpen && (
          <div className="max-h-40 overflow-y-auto border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
            {presence.length === 0 ? (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                접속 중인 유저가 없습니다.
              </div>
            ) : (
              <ul className="space-y-0.5">
                {presence.map((u, i) => (
                  <li
                    key={`${u.name}-${i}`}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {u.className && u.className !== DEFAULT_CLASS_NAME && (
                      <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {u.className}
                      </span>
                    )}
                    {u.title && (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {u.title}
                      </span>
                    )}
                    {u.mine ? (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {u.name}
                        <span className="ml-1 text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                          (나)
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPmTarget(u.name)}
                        title="쪽지 보내기"
                        className="rounded font-semibold text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-200"
                      >
                        {u.name}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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
                  {m.className && m.className !== DEFAULT_CLASS_NAME && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {m.className}
                    </span>
                  )}
                  {m.title && (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {m.title}
                    </span>
                  )}
                  {m.mine ? (
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                      {m.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPmTarget(m.name)}
                      title="쪽지 보내기"
                      className="rounded font-semibold text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-200"
                    >
                      {m.name}
                    </button>
                  )}
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
            maxLength={CHAT_MAX_LENGTH}
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

      {pmTarget && (
        <SendMessageModal
          initialRecipient={pmTarget}
          onClose={() => setPmTarget(null)}
        />
      )}
    </div>
  );
}
