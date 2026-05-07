import { Card } from "@/components/ui/Card";
import { STAT_KEYS, STAT_LABELS, type StatKey } from "@/adventure/data/stats";
import { formatDuration } from "@/lib/format";
import { STAT_ICONS, STAT_ICON_COLORS } from "./statMeta";

export function TrainingView({
  trainingEndsAt,
  unspentPoints,
  now,
  onStartTraining,
  onAllocateStat,
}: {
  trainingEndsAt: number | null;
  unspentPoints: number;
  now: number;
  onStartTraining: () => void;
  onAllocateStat: (key: StatKey) => void;
}) {
  const remaining = trainingEndsAt ? Math.max(0, trainingEndsAt - now) : 0;
  const isTraining = !!trainingEndsAt && remaining > 0;
  const canAllocate = unspentPoints > 0;

  return (
    <Card as="section" padding="lg">
      <div className="space-y-6">
        <button
          type="button"
          onClick={onStartTraining}
          disabled={isTraining}
          className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-4 py-3 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {isTraining
            ? `훈련 중 · ${formatDuration(remaining)}`
            : "4시간 훈련 시작"}
        </button>

        <div>
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span>스탯 단련</span>
            <span className="tabular-nums">단련 포인트 {unspentPoints}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STAT_KEYS.map((k) => {
              const Icon = STAT_ICONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onAllocateStat(k)}
                  disabled={!canAllocate}
                  className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-base transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
                >
                  <Icon
                    size={22}
                    weight="duotone"
                    className={`shrink-0 ${STAT_ICON_COLORS[k]}`}
                  />
                  <span className="flex-1 text-left font-medium text-zinc-700 dark:text-zinc-200">
                    {STAT_LABELS[k]} 단련
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                    +1
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
