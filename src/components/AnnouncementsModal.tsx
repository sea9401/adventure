"use client";

import { Megaphone, X } from "@phosphor-icons/react";
import {
  ANNOUNCEMENTS,
  type Announcement,
  type AnnouncementCategory,
} from "@/lib/announcements";
import { useEscapeKey } from "@/lib/useEscapeKey";

const CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
  feature: "신규",
  balance: "조정",
  fix: "수정",
};

const CATEGORY_STYLE: Record<AnnouncementCategory, string> = {
  feature:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  balance:
    "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  fix: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

export function AnnouncementsModal({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcements-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Megaphone
              size={22}
              weight="duotone"
              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            <div>
              <h2
                id="announcements-modal-title"
                className="text-xl font-semibold text-zinc-900 dark:text-zinc-100"
              >
                공지 사항
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                최근 업데이트 내역을 안내드립니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {ANNOUNCEMENTS.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            아직 등록된 공지가 없습니다.
          </p>
        ) : (
          <ul className="mt-5 space-y-5">
            {ANNOUNCEMENTS.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <li className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {announcement.title}
        </h3>
        <time className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {announcement.date}
        </time>
      </header>
      {announcement.intro && (
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {announcement.intro}
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {announcement.items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200"
          >
            <span
              className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLE[item.category]}`}
            >
              {CATEGORY_LABEL[item.category]}
            </span>
            <span className="min-w-0 flex-1">{item.text}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}
