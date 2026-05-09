"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellRinging } from "@phosphor-icons/react";
import {
  formatRelative,
  type AppNotification,
} from "@/lib/notifications";

export function NotificationBell({
  notifications,
  unreadCount,
  onOpen,
}: {
  notifications: AppNotification[];
  unreadCount: number;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const handleToggle = () => {
    if (!open && unreadCount > 0) onOpen();
    setOpen((v) => !v);
  };

  const Icon = unreadCount > 0 ? BellRinging : Bell;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`알림${unreadCount > 0 ? ` (${unreadCount}개 새 알림)` : ""}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Icon size={20} weight="duotone" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-8rem))] origin-top-right overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-3 py-2 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            알림
          </div>
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              알림이 없습니다.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {notifications.slice(0, 10).map((n) => (
                <li
                  key={n.id}
                  className="border-b border-zinc-100 px-3 py-2 text-sm last:border-b-0 dark:border-zinc-800/60"
                >
                  <div className="text-zinc-800 dark:text-zinc-200">
                    {n.text}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {formatRelative(n.timestamp)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
