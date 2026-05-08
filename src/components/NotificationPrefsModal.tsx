"use client";

import { X } from "@phosphor-icons/react";
import {
  TOAST_KIND_LABELS,
  TOAST_KIND_ORDER,
  useToastPrefs,
} from "@/lib/notification-prefs";

export function NotificationPrefsModal({ onClose }: { onClose: () => void }) {
  const { prefs, setPref } = useToastPrefs();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-prefs-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="notif-prefs-title"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
            >
              알림 설정
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              화면 우상단 토스트 알림을 종류별로 켜고 끌 수 있어요. 벨/최근 기록에는 모든 알림이 항상 남습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <ul className="mt-4 space-y-1">
          {TOAST_KIND_ORDER.map((kind) => {
            const meta = TOAST_KIND_LABELS[kind];
            const enabled = prefs[kind];
            return (
              <li key={kind}>
                <label className="flex cursor-pointer items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {meta.name}
                    </span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                      {meta.description}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setPref(kind, e.target.checked)}
                    aria-label={`${meta.name} 알림`}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-emerald-500"
                  />
                </label>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
