"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Backpack,
  CaretDown,
  ChatCircle,
  PaperPlaneTilt,
  Users,
  X,
} from "@phosphor-icons/react";
import { formatRelative } from "@/lib/notifications";
import { CHAT_MAX_LENGTH, isNoticeMessage } from "@/lib/chat-config";
import {
  encodeItemLink,
  parseChatContent,
  type ChatItemRef,
} from "@/lib/chat-item-link";
import { useGame } from "@/adventure/GameContext";
import { SendMessageModal } from "@/adventure/marketplace/SendMessageModal";
import { ChatItemChip } from "./ChatItemChip";
import { ChatItemPicker } from "./ChatItemPicker";

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

// 메시지 본문 — [[item:...]] 토큰을 인라인 아이템 칩으로 치환. 토큰이 없으면 평문 그대로.
function MessageBody({ content }: { content: string }) {
  const segments = useMemo(() => parseChatContent(content), [content]);
  if (segments.length === 1 && segments[0].type === "text") return <>{content}</>;
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <ChatItemChip key={i} link={seg} />
        ),
      )}
    </>
  );
}

export function ChatPanel({
  open,
  onClose,
  name,
  className,
  title,
  messages,
  onMessageSent,
  unreadChat = false,
  unreadNotice = false,
  onSeen,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  className: string;
  title: string | null;
  messages: ChatMessage[];
  onMessageSent: (m: ChatMessage) => void;
  /** 채팅/알림 탭별 안 읽은 메시지 유무 — 탭에 점 표시. */
  unreadChat?: boolean;
  unreadNotice?: boolean;
  /** 해당 탭의 최신 메시지를 본 것으로 처리. */
  onSeen?: (kind: "chat" | "notice", lastId: number) => void;
}) {
  const game = useGame();
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pmTarget, setPmTarget] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // 채팅 / 알림(협동 보스 등 시스템 메시지) 탭 분리.
  const [tab, setTab] = useState<"chat" | "notice">("chat");
  // 낙관적 전송 — 서버 응답 전 임시 메시지 큐. 응답 도착 시 큐에서 제거.
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const tempIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  // 권위적 messages + 낙관적 pending 을 합쳐 화면용 리스트 생성.
  // 서버 echo 와 임시 메시지가 일시적으로 겹쳐 보이지 않도록, 본인이 보낸
  // 권위적 메시지가 들어오면 같은 content 의 가장 오래된 pending 을 숨긴다.
  const visibleMessages = useMemo(() => {
    if (pending.length === 0) return messages;
    const remainingPending = [...pending];
    for (const m of messages) {
      if (!m.mine) continue;
      const i = remainingPending.findIndex((p) => p.content === m.content);
      if (i >= 0) remainingPending.splice(i, 1);
    }
    return [...messages, ...remainingPending];
  }, [messages, pending]);

  // 일반 채팅 / 시스템 알림(협동 보스 스폰·토벌 등) 을 className 으로 갈라낸다.
  const chatMessages = useMemo(
    () => visibleMessages.filter((m) => !isNoticeMessage(m)),
    [visibleMessages],
  );
  const noticeMessages = useMemo(
    () => visibleMessages.filter((m) => isNoticeMessage(m)),
    [visibleMessages],
  );
  const shownMessages = tab === "chat" ? chatMessages : noticeMessages;

  // 권위적 messages 만 보고 (낙관적 pending 의 음수 임시 id 제외) 각 카테고리 최신 id 계산.
  const lastChatId = useMemo(
    () => messages.reduce((mx, m) => (!isNoticeMessage(m) && m.id > mx ? m.id : mx), 0),
    [messages],
  );
  const lastNoticeId = useMemo(
    () => messages.reduce((mx, m) => (isNoticeMessage(m) && m.id > mx ? m.id : mx), 0),
    [messages],
  );

  // 패널이 열려 있는 동안 보고 있는 탭의 최신 메시지는 읽은 것으로 보고.
  useEffect(() => {
    if (!open || !onSeen) return;
    if (tab === "chat" && lastChatId > 0) onSeen("chat", lastChatId);
    if (tab === "notice" && lastNoticeId > 0) onSeen("notice", lastNoticeId);
  }, [open, tab, lastChatId, lastNoticeId, onSeen]);

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

  // 패널을 처음 열었을 때 한 번은 무조건 맨 아래로 — 최신 메시지부터 보이게.
  // open 이 false 가 되면 다음 열림에 다시 한 번 트리거되도록 ref 리셋.
  const initialScrolledRef = useRef(false);
  useEffect(() => {
    if (!open) initialScrolledRef.current = false;
  }, [open]);

  // 새 메시지가 추가되면 자동 스크롤 (이미 하단 근처에 있을 때만).
  // 단, open 직후 첫 메시지 도착 시점엔 강제로 맨 아래로 한 번 정렬.
  // visibleMessages 를 관찰 — 낙관적 임시 메시지에도 즉시 스크롤이 따라간다.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (open && !initialScrolledRef.current && shownMessages.length > 0) {
      el.scrollTop = el.scrollHeight;
      initialScrolledRef.current = true;
      return;
    }
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [shownMessages, open]);

  // 탭을 바꾸면 그 탭의 맨 아래(최신)로 한 번 정렬.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tab]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    // 임시 id 는 음수 — 서버 id (양수) 와 절대 충돌하지 않음.
    const tempId = --tempIdRef.current;
    const temp: ChatMessage = {
      id: tempId,
      name,
      className,
      title,
      content: trimmed,
      createdAt: Date.now(),
      mine: true,
    };
    setPending((prev) => [...prev, temp]);
    setDraft("");
    setError(null);
    try {
      const sent = await postMessage({
        name,
        className,
        title,
        content: trimmed,
      });
      // 서버 응답 도착 — 부모 messages 에 합류. visibleMessages 가 content 매칭으로
      // pending 의 임시 항목을 자동 숨겨주므로 setPending 정리는 다음 폴링 후에 해도 OK.
      // 다만 명시적으로 제거해 메모리/길이 누적을 막는다.
      setPending((prev) => prev.filter((m) => m.id !== tempId));
      onMessageSent(sent);
    } catch (err) {
      // 실패 — 임시 메시지 회수 + 본문 복원해 재시도 유도.
      setPending((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(trimmed);
      const msg = err instanceof Error ? err.message : "";
      setError(translateChatError(msg));
    }
  };

  // 아이템 피커에서 고른 장비를 토큰으로 입력창에 삽입. 200자 초과면 막는다.
  const insertItemLink = (ref: ChatItemRef) => {
    const token = encodeItemLink(ref);
    const sep = draft && !/\s$/.test(draft) ? " " : "";
    const next = `${draft}${sep}${token} `;
    if (next.length > CHAT_MAX_LENGTH) {
      setError("메시지가 너무 깁니다.");
      return;
    }
    setError(null);
    setDraft(next);
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
          <div className="no-scrollbar max-h-40 overflow-y-auto border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
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

        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          {(
            [
              ["chat", "채팅", chatMessages.length, unreadChat],
              ["notice", "알림", noticeMessages.length, unreadNotice],
            ] as const
          ).map(([key, label, count, unread]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key}
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                tab === key
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {label}
              {unread && tab !== key && (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              )}
              {count > 0 && (
                <span className="rounded-full bg-zinc-200 px-1.5 text-[10px] tabular-nums text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div
          ref={listRef}
          className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-3 py-2"
        >
          {shownMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
              {tab === "chat"
                ? "아직 메시지가 없습니다."
                : "협동 보스 알림이 없습니다."}
            </div>
          ) : (
            shownMessages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col gap-0.5 ${m.mine ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
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
                  <MessageBody content={m.content} />
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

        {tab === "notice" ? (
          <div className="border-t border-zinc-200 px-3 py-2.5 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            협동 보스 알림 — 채팅하려면 채팅 탭으로
          </div>
        ) : (
        <form
          onSubmit={submit}
          className="flex items-center gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800"
        >
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="보유 아이템 자랑하기"
            title="보유 아이템 링크"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Backpack size={18} weight="duotone" />
          </button>
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
            disabled={!draft.trim()}
            aria-label="전송"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </button>
        </form>
        )}
      </div>

      {pmTarget && (
        <SendMessageModal
          initialRecipient={pmTarget}
          onClose={() => setPmTarget(null)}
        />
      )}

      {pickerOpen && (
        <ChatItemPicker
          inventory={game.inventory.state}
          onPick={insertItemLink}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
