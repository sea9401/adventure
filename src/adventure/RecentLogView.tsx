import {
  formatRelative,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";

const KIND_COLOR: Record<NotificationKind, string> = {
  battle_win: "text-emerald-600 dark:text-emerald-400",
  battle_lose: "text-rose-600 dark:text-rose-400",
  training_done: "text-amber-600 dark:text-amber-400",
  info: "text-zinc-600 dark:text-zinc-400",
};

function formatAbsolute(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentLogView({
  notifications,
}: {
  notifications: AppNotification[];
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
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90">
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {notifications.map((n) => (
          <li key={n.id} className="px-4 py-3">
            <div className={`text-sm ${KIND_COLOR[n.kind]}`}>{n.text}</div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>{formatAbsolute(n.timestamp)}</span>
              <span aria-hidden>·</span>
              <span>{formatRelative(n.timestamp)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
