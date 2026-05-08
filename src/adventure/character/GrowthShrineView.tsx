"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { STAT_KEYS, STAT_LABELS, type StatKey } from "@/adventure/data/stats";
import { STAT_ICONS, STAT_ICON_COLORS } from "./statMeta";

// 성장의 신전 — 단련 포인트로 스탯 분배 (+), 되돌리기 포인트로 차감 (-).
// 차감은 되돌리기 포인트 1개 소모하고 단련 포인트 1개 환불.
export function GrowthShrineView({
  unspentPoints,
  revertPoints,
  allocatedStats,
  baseStats,
  onAllocate,
  onDeallocate,
}: {
  unspentPoints: number;
  revertPoints: number;
  allocatedStats: Record<StatKey, number>;
  baseStats: Record<StatKey, number>;
  onAllocate: (key: StatKey) => void;
  onDeallocate: (key: StatKey) => void;
}) {
  return (
    <Card as="section" padding="lg">
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          이곳에서 모험으로 얻은 단련을 능력으로 새겨넣을 수 있다. 새긴 능력은
          되돌리기 포인트로 다시 풀어낼 수 있다.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <PointBadge label="단련 포인트" value={unspentPoints} tone="emerald" />
          <PointBadge label="되돌리기 포인트" value={revertPoints} tone="amber" />
        </div>

        <div className="space-y-2">
          {STAT_KEYS.map((k) => {
            const Icon = STAT_ICONS[k];
            const allocated = allocatedStats[k] ?? 0;
            const total = (baseStats[k] ?? 0) + allocated;
            const canAdd = unspentPoints > 0;
            const canSub = revertPoints > 0 && allocated > 0;
            return (
              <div
                key={k}
                className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <Icon
                  size={22}
                  weight="duotone"
                  className={`shrink-0 ${STAT_ICON_COLORS[k]}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {STAT_LABELS[k]}
                  </div>
                  <div className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    합계 {total}
                    {allocated > 0 && (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                        (+{allocated})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDeallocate(k)}
                    disabled={!canSub}
                    aria-label={`${STAT_LABELS[k]} 되돌리기`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Minus size={14} weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onAllocate(k)}
                    disabled={!canAdd}
                    aria-label={`${STAT_LABELS[k]} 단련`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-700 bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={14} weight="bold" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function PointBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${cls}`}>
      <div className="uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
