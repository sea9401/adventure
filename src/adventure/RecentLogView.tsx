"use client";

import { useState } from "react";
import { CaretDown, CaretRight, Trash } from "@phosphor-icons/react";
import {
  formatRelative,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";
import { Card } from "@/components/ui/Card";

const KIND_COLOR: Record<NotificationKind, string> = {
  battle_win: "text-emerald-600 dark:text-emerald-400",
  battle_lose: "text-rose-600 dark:text-rose-400",
  training_done: "text-amber-600 dark:text-amber-400",
  quest_ready: "text-yellow-700 dark:text-yellow-400",
  quest_complete: "text-violet-700 dark:text-violet-400",
  info: "text-zinc-600 dark:text-zinc-400",
};

// BattleScene과 동일한 줄별 색상 매핑.
function logLineColor(kind: string): string {
  if (kind === "player_attack") return "text-emerald-700 dark:text-emerald-400";
  if (kind === "enemy_attack") return "text-rose-700 dark:text-rose-400";
  return "text-zinc-600 dark:text-zinc-400";
}

function formatAbsolute(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NotificationRow({ n }: { n: AppNotification }) {
  const [open, setOpen] = useState(false);
  const battleLog = n.meta?.battleLog;
  const expandable = !!battleLog && battleLog.length > 0;

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        className={`flex w-full items-start gap-2 text-left ${
          expandable ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {expandable && (
          <span
            aria-hidden
            className="mt-0.5 shrink-0 text-zinc-400 dark:text-zinc-500"
          >
            {open ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <div className={`text-sm ${KIND_COLOR[n.kind]}`}>{n.text}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>{formatAbsolute(n.timestamp)}</span>
            <span aria-hidden>·</span>
            <span>{formatRelative(n.timestamp)}</span>
          </div>
        </span>
      </button>
      {expandable && open && (
        <div className="mt-2 ml-5 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          {battleLog.map((entry, i) => (
            <div key={i} className={logLineColor(entry.kind)}>
              {entry.text}
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

export function RecentLogView({
  notifications,
  onClear,
}: {
  notifications: AppNotification[];
  onClear?: () => void;
}) {
  if (notifications.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/90">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          아직 기록된 알림이 없습니다.
        </div>
      </section>
    );
  }
  return (
    <div className="space-y-2">
      {onClear && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("최근 기록을 모두 삭제할까요?")) onClear();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
          >
            <Trash size={12} weight="bold" />
            전체 삭제
          </button>
        </div>
      )}
      <Card as="section" padding="none" className="overflow-hidden">
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {notifications.map((n) => (
            <NotificationRow key={n.id} n={n} />
          ))}
        </ul>
      </Card>
    </div>
  );
}
