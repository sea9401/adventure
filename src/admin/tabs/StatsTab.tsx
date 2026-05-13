"use client";

import { Button } from "../ui/Field";
import { useAdminStats } from "./stats/useAdminStats";
import { StatsKpiCards, StatsDistributions } from "./stats/StatsKpis";
import { StatsTable } from "./stats/StatsTable";

export function StatsTab() {
  const {
    filtered,
    sorted,
    loading,
    error,
    refetch,
    sortKey,
    sortDir,
    onSort,
    hideEmpty,
    setHideEmpty,
  } = useAdminStats();

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">유저 진척 통계</h2>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={hideEmpty}
                onChange={(e) => setHideEmpty(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span>미플레이 유저 숨기기</span>
            </label>
            <Button onClick={refetch} disabled={loading}>
              {loading ? "로딩…" : "새로고침"}
            </Button>
          </div>
        </div>
        {error ? (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}
        <StatsKpiCards rows={filtered} />
      </section>

      <StatsDistributions rows={filtered} />

      <StatsTable
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        loading={loading}
      />
    </div>
  );
}
