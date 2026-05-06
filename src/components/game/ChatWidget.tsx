"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/game/store";

type Message = {
  nickname: string;
  text: string;
  at: number;
};

const POLL_INTERVAL_MS = 5000;

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"checking" | "enabled" | "disabled">("checking");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nickname = useGame((s) => s.character.name);

  useEffect(() => {
    let alive = true;
    const fetchMessages = async () => {
      try {
        const res = await fetch("/api/chat");
        if (!alive) return;
        const data = (await res.json()) as { messages: Message[]; disabled?: boolean };
        if (data.disabled) {
          setStatus("disabled");
          return;
        }
        setStatus("enabled");
        setMessages(data.messages ?? []);
      } catch {
        setStatus("disabled");
      }
    };
    fetchMessages();
    const id = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !nickname.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), text }),
      });
      if (res.ok) {
        setDraft("");
        const data = await fetch("/api/chat").then((r) => r.json());
        setMessages(data.messages ?? []);
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  if (status !== "enabled") return null;

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 text-sm font-medium shadow-lg"
        >
          💬 채팅
        </button>
      ) : (
        <div className="w-96 h-[32rem] bg-panel border border-line-2 rounded-lg shadow-2xl flex flex-col">
          <div className="px-3 py-2 border-b border-line flex items-center justify-between">
            <span className="text-sm font-medium text-fg-strong">실시간 채팅</span>
            <button
              onClick={() => setOpen(false)}
              className="text-fg-faint hover:text-fg text-sm"
              aria-label="close"
            >
              ✕
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {messages.length === 0 ? (
              <p className="text-xs text-fg-faint italic">아직 메시지가 없습니다.</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className="text-emerald-400 font-medium">{m.nickname}</span>
                  <span className="text-fg-faint text-xs ml-2">{formatTime(m.at)}</span>
                  <div className="text-fg break-words whitespace-pre-wrap">{m.text}</div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-line p-2 space-y-1.5">
            <p className="text-[10px] text-fg-faint">
              닉네임: <span className="text-fg">{nickname}</span> (캐릭터 이름)
            </p>
            <div className="flex gap-1">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder="메시지 입력..."
                disabled={!nickname.trim() || sending}
                className="flex-1 bg-panel-2 border border-line-2 rounded px-2 py-1 text-sm text-fg-strong focus:outline-none focus:border-fg-faint disabled:opacity-50"
                maxLength={200}
              />
              <button
                onClick={send}
                disabled={!nickname.trim() || !draft.trim() || sending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-30"
              >
                전송
              </button>
            </div>
            <p className="text-[10px] text-fg-dim text-center">5초마다 갱신</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(at: number): string {
  const d = new Date(at);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
