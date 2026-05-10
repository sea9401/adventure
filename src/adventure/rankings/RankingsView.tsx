"use client";

import { useState } from "react";
import { Trophy } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useRankings,
  type RankingMetric,
  type RankingEntry,
  type RankingMe,
} from "./useRankings";

const TABS: { key: RankingMetric; label: string }[] = [
  { key: "level", label: "레벨" },
  { key: "fame", label: "명성" },
  { key: "battleCount", label: "전투 횟수" },
];

const METRIC_LABEL: Record<RankingMetric, string> = {
  level: "Lv.",
  fame: "명성",
  battleCount: "전투",
};

const valueFor = (
  e: { level: number; fame: number; battleCount: number },
  metric: RankingMetric,
): number => {
  if (metric === "level") return e.level;
  if (metric === "fame") return e.fame;
  return e.battleCount;
};

export function RankingsView() {
  const [metric, setMetric] = useState<RankingMetric>("level");
  const { list, me, loading, error } = useRankings(metric);

  const meInList = !!me && !!list?.some((e) => e.mine);

  return (
    <div className="space-y-3">
      <Card as="section" padding="sm">
        <TabBar
          tabs={TABS}
          active={metric}
          onChange={(k) => setMetric(k)}
          ariaLabel="랭킹 지표"
        />
      </Card>

      {error && (
        <Card as="section" padding="md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </Card>
      )}

      {loading && list === null ? (
        <ul className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="rounded-lg border border-zinc-200 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/60"
            >
              <Skeleton rows={2} />
            </li>
          ))}
        </ul>
      ) : !list || list.length === 0 ? (
        <EmptyState
          icon={<Trophy size={40} weight="duotone" />}
          title="아직 등록된 모험가가 없습니다"
          message="닉네임을 가진 모험가가 자동으로 명부에 오릅니다."
        />
      ) : (
        <Card as="section" padding="none">
          <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.map((e) => (
              <RankingRow key={`${e.rank}-${e.name}`} entry={e} metric={metric} />
            ))}
          </ol>
        </Card>
      )}

      {me && !meInList && (
        <Card as="section" padding="none">
          <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            내 순위
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <RankingRow
              entry={{ ...me, mine: true }}
              metric={metric}
            />
          </div>
        </Card>
      )}
    </div>
  );
}

function RankingRow({
  entry,
  metric,
}: {
  entry: RankingEntry | (RankingMe & { mine: true });
  metric: RankingMetric;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 ${
        entry.mine ? "bg-emerald-50 dark:bg-emerald-950/40" : ""
      }`}
    >
      <span className="flex items-center gap-3 min-w-0">
        <RankBadge rank={entry.rank} />
        <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
          {entry.name}
          {entry.mine && (
            <span className="ml-1 text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
              (나)
            </span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-sm tabular-nums text-zinc-700 dark:text-zinc-200">
        {METRIC_LABEL[metric]} {valueFor(entry, metric)}
      </span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colorCls =
    rank === 1
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : rank === 2
        ? "bg-zinc-400/15 text-zinc-600 dark:text-zinc-300"
        : rank === 3
          ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
          : "bg-zinc-200/40 text-zinc-500 dark:bg-zinc-800/40 dark:text-zinc-400";
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${colorCls}`}
    >
      {rank}
    </span>
  );
}
