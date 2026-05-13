"use client";

import type { EnrichedRow, SortDir, SortKey } from "./useAdminStats";
import { SUSPECT_BPH_THRESHOLD } from "./useAdminStats";

function formatHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}분`;
  if (h < 24) return `${h.toFixed(1)}시간`;
  return `${Math.floor(h / 24)}일`;
}

export function StatsTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  loading,
}: {
  rows: EnrichedRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  loading: boolean;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">유저별 상세</h2>
      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        시간당 전투 수가 ≥ {SUSPECT_BPH_THRESHOLD} 이면 &quot;켜두고 자기&quot; 의심 (붉게 표시).
        1전 평균 1~2분 가정.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="text-zinc-500">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-1 text-left font-medium">유저</th>
              <SortHeader
                sortKey="level"
                current={sortKey}
                dir={sortDir}
                onClick={onSort}
                align="right"
              >
                Lv
              </SortHeader>
              <SortHeader
                sortKey="battleCount"
                current={sortKey}
                dir={sortDir}
                onClick={onSort}
                align="right"
              >
                전투
              </SortHeader>
              <SortHeader
                sortKey="battlesPerHour"
                current={sortKey}
                dir={sortDir}
                onClick={onSort}
                align="right"
              >
                /시간
              </SortHeader>
              <SortHeader
                sortKey="createdAt"
                current={sortKey}
                dir={sortDir}
                onClick={onSort}
                align="right"
              >
                가입 후
              </SortHeader>
              <SortHeader
                sortKey="lastSeenAt"
                current={sortKey}
                dir={sortDir}
                onClick={onSort}
                align="right"
              >
                마지막 접속
              </SortHeader>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const suspect = r.battlesPerHour >= SUSPECT_BPH_THRESHOLD;
              return (
                <tr
                  key={r.userId}
                  className={
                    "border-b border-zinc-100 dark:border-zinc-900 " +
                    (suspect
                      ? "bg-red-50 dark:bg-red-950/30"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40")
                  }
                >
                  <td className="py-1">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {r.name ?? "(이름 없음)"}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-500">
                      {r.email ?? r.userId}
                    </div>
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {r.level ?? "—"}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {r.battleCount.toLocaleString()}
                  </td>
                  <td
                    className={
                      "py-1 text-right tabular-nums " +
                      (suspect
                        ? "font-semibold text-red-700 dark:text-red-400"
                        : "")
                    }
                  >
                    {r.battlesPerHour.toFixed(1)}
                  </td>
                  <td className="py-1 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {formatHours(r.hoursSinceJoin)}
                  </td>
                  <td className="py-1 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {formatHours(r.hoursSinceLastSeen)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="py-3 text-center text-zinc-500">
                  표시할 유저가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SortHeader({
  sortKey,
  current,
  dir,
  onClick,
  children,
  align = "left",
}: {
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const active = sortKey === current;
  return (
    <th className={`py-1 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={
          "inline-flex items-center gap-0.5 hover:text-zinc-900 dark:hover:text-zinc-100 " +
          (active ? "text-zinc-900 dark:text-zinc-100" : "")
        }
      >
        {children}
        {active ? <span>{dir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );
}
