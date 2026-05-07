import { STAT_KEYS, STAT_LABELS, type StatKey } from "@/adventure/data/stats";

export function StatsPanel({ stats }: { stats: Record<StatKey, number> }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        능력치
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {STAT_KEYS.map((k) => (
          <div
            key={k}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {STAT_LABELS[k]}
            </div>
            <div className="mt-0.5 text-base font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {stats[k]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
