"use client";

import { useEffect, useRef, useState } from "react";
import type { AppNotification } from "@/lib/notifications";

const TOAST_DURATION_MS = 3000;
const MAX_VISIBLE_TOASTS = 3;

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

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex flex-col gap-2 sm:right-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto max-w-sm rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-800 shadow-lg animate-in slide-in-from-right dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
