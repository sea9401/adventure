"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import type { AppNotification, NotificationKind } from "@/lib/notifications";

const TOAST_DURATION_MS = 2000;
const MAX_VISIBLE_TOASTS = 3;

// 토스트로 띄우지 않을 알림 종류 — 사용자가 직접 일으킨 액션의 결과는 토스트 대신 벨/로그에서만 확인.
const TOAST_BLOCKED_KINDS = new Set<NotificationKind>([
  "battle_win",
  "battle_lose",
]);

type ToastItem = {
  id: string;
  text: string;
};

export function NotificationToast({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const initRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);

  // 신규 알림 감지 — 마운트 시점 이전 알림은 토스트 안 띄움.
  // 외부 props(notifications)를 관찰해 큐 누적 — set-state-in-effect 패턴이지만
  // 외부 변화 구독 케이스라 의도적.
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      lastIdRef.current = notifications[0]?.id ?? null;
      return;
    }
    if (notifications.length === 0) return;
    const latest = notifications[0];
    if (latest.id === lastIdRef.current) return;
    lastIdRef.current = latest.id;
    if (TOAST_BLOCKED_KINDS.has(latest.kind)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToasts((prev) =>
      [...prev, { id: latest.id, text: latest.text }].slice(-MAX_VISIBLE_TOASTS),
    );
  }, [notifications]);

  // 가장 오래된 토스트부터 자동 제거.
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [toasts]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex flex-col gap-2 sm:right-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border border-zinc-200 bg-white py-2 pl-4 pr-2 text-sm text-zinc-800 shadow-lg animate-in slide-in-from-right dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <span className="flex-1 pt-0.5">{t.text}</span>
          <button
            type="button"
            aria-label="알림 닫기"
            onClick={() => dismiss(t.id)}
            className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      ))}
    </div>
  );
}
