"use client";

import { useEffect, useRef, useState } from "react";
import {
  Barbell,
  CheckCircle,
  Info,
  Scroll,
  Skull,
  Sword,
  X,
} from "@phosphor-icons/react";
import type { AppNotification, NotificationKind } from "@/lib/notifications";
import { useToastPrefs } from "@/lib/notification-prefs";

const TOAST_DURATION_MS = 2000;
const MAX_VISIBLE_TOASTS = 3;

type ToastItem = {
  id: string;
  text: string;
  kind: NotificationKind;
};

// 토스트 좌측 색띠 — 종류 한 눈에 구분.
const TOAST_ACCENT: Record<NotificationKind, string> = {
  battle_win: "bg-emerald-500",
  battle_lose: "bg-rose-500",
  training_done: "bg-amber-500",
  quest_ready: "bg-yellow-500",
  quest_complete: "bg-violet-500",
  info: "bg-sky-500",
};

const TOAST_ICON: Record<NotificationKind, React.ComponentType<{ size?: number; weight?: "fill" | "duotone" | "regular" | "bold"; className?: string }>> = {
  battle_win: Sword,
  battle_lose: Skull,
  training_done: Barbell,
  quest_ready: Scroll,
  quest_complete: CheckCircle,
  info: Info,
};

const TOAST_ICON_COLOR: Record<NotificationKind, string> = {
  battle_win: "text-emerald-600 dark:text-emerald-400",
  battle_lose: "text-rose-600 dark:text-rose-400",
  training_done: "text-amber-600 dark:text-amber-400",
  quest_ready: "text-yellow-600 dark:text-yellow-400",
  quest_complete: "text-violet-600 dark:text-violet-400",
  info: "text-sky-600 dark:text-sky-400",
};

export function NotificationToast({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const initRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);
  const { prefs } = useToastPrefs();
  // useEffect deps 안정화를 위한 ref — prefs 가 바뀐다고 옛 알림을 토스트로 띄우진 않음.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

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
    // 사용자 선호 — 해당 종류가 OFF 면 토스트 안 띄움.
    if (!prefsRef.current[latest.kind]) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToasts((prev) =>
      [...prev, { id: latest.id, text: latest.text, kind: latest.kind }].slice(
        -MAX_VISIBLE_TOASTS,
      ),
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
      {toasts.map((t) => {
        const Icon = TOAST_ICON[t.kind];
        return (
        <div
          key={t.id}
          className="pointer-events-auto relative flex max-w-[calc(100vw-2rem)] items-start gap-2 overflow-hidden rounded-lg border border-zinc-200 bg-white py-2 pl-4 pr-2 text-sm text-zinc-800 shadow-lg animate-in slide-in-from-right sm:max-w-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <span
            aria-hidden
            className={`absolute inset-y-0 left-0 w-1 ${TOAST_ACCENT[t.kind]}`}
          />
          <Icon
            size={16}
            weight="duotone"
            className={`mt-0.5 shrink-0 ${TOAST_ICON_COLOR[t.kind]}`}
          />
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
        );
      })}
    </div>
  );
}
