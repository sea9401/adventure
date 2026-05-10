"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Field";
import type { AdminStatsRow } from "@/app/api/admin/stats/route";

type SortKey =
  | "createdAt"
  | "lastSeenAt"
  | "level"
  | "battleCount"
  | "battlesPerHour";

type SortDir = "asc" | "desc";

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3_600_000;
}

function formatHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}분`;
  if (h < 24) return `${h.toFixed(1)}시간`;
  return `${Math.floor(h / 24)}일`;
}

// 진척 심사 — battlesPerHour 가 30 이상이면 "켜두고 자기" 강한 의심 (1전 평균 1~2분 가정).
const SUSPECT_BPH_THRESHOLD = 30;

export function StatsTab() {
  const [rows, setRows] = useState<AdminStatsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("battlesPerHour");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [hideEmpty, setHideEmpty] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/stats");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows((await r.json()) as AdminStatsRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  // 클라이언트에서 derive 컬럼 계산.
  const enriched = useMemo(() => {
    return rows.map((r) => {
      const hoursSinceJoin = hoursSince(r.createdAt) ?? 0;
      const hoursSinceLastSeen = hoursSince(r.lastSeenAt);
      const battlesPerHour =
        hoursSinceJoin > 0 ? r.battleCount / hoursSinceJoin : 0;
      return {
        ...r,
        hoursSinceJoin,
        hoursSinceLastSeen,
        battlesPerHour,
      };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    return hideEmpty
      ? enriched.filter((r) => (r.level ?? 0) > 1 || r.battleCount > 0)
      : enriched;
  }, [enriched, hideEmpty]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const aNull = av == null;
      const bNull = bv == null;
      if (aNull && bNull) return 0;
      if (aNull) return 1; // null 항상 뒤
      if (bNull) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const summary = useMemo(() => buildSummary(filtered), [filtered]);
  const levelHistogram = useMemo(() => buildLevelHistogram(filtered), [
    filtered,
  ]);
  const milestones = useMemo(() => buildMilestones(filtered), [filtered]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

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
            <Button onClick={reload} disabled={loading}>
              {loading ? "로딩…" : "새로고침"}
            </Button>
          </div>
        </div>
        {error ? (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Card label="유저 수" value={`${summary.count}명`} />
          <Card label="평균 레벨" value={summary.avgLevel.toFixed(1)} />
          <Card
            label="평균 전투 수"
            value={Math.round(summary.avgBattles).toLocaleString()}
          />
          <Card
            label="시간당 전투 (중앙값 / 최대)"
            value={`${summary.medianBph.toFixed(1)} / ${summary.maxBph.toFixed(1)}`}
          />
          <Card label="Lv 30+ 유저" value={`${summary.lv30Count}명`} />
          <Card
            label="의심(시간당 ≥ 30전)"
            value={`${summary.suspectCount}명`}
          />
          <Card
            label="최근 24h 활동"
            value={`${summary.activeIn24h}명`}
          />
          <Card
            label="최근 7d 활동"
            value={`${summary.activeIn7d}명`}
          />
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">마일스톤 도달까지 (가입 후)</h2>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          현재 레벨 ≥ 임계 인 유저들의 가입 후 경과 시간 분포 — 정확한 도달 시점은 모르므로
          <strong> 상한 추정</strong>입니다 (실제 도달은 더 빨랐을 수 있음).
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead className="text-zinc-500">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-1 text-left font-medium">임계 Lv</th>
                <th className="py-1 text-right font-medium">유저 수</th>
                <th className="py-1 text-right font-medium">P50 (중앙값)</th>
                <th className="py-1 text-right font-medium">P25 (빠른 25%)</th>
                <th className="py-1 text-right font-medium">P75</th>
                <th className="py-1 text-right font-medium">최단</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr
                  key={m.threshold}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="py-1 font-mono">Lv {m.threshold}</td>
                  <td className="py-1 text-right tabular-nums">{m.count}</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatHours(m.p50)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatHours(m.p25)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatHours(m.p75)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatHours(m.min)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">레벨 분포</h2>
        <div className="mt-2 space-y-0.5">
          {levelHistogram.map((b) => (
            <div key={b.bucket} className="flex items-center gap-2 text-[11px]">
              <span className="w-16 font-mono text-zinc-500">{b.label}</span>
              <div
                className="h-3 rounded bg-emerald-500/70 dark:bg-emerald-400/70"
                style={{ width: `${(b.count / summary.maxBucket) * 100}%` }}
              />
              <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                {b.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">유저별 상세</h2>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          시간당 전투 수가 ≥ {SUSPECT_BPH_THRESHOLD} 이면 "켜두고 자기" 의심 (붉게 표시).
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
              {sorted.map((r) => {
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
              {sorted.length === 0 && !loading ? (
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
    </div>
  );
}

function sortValue(
  r: AdminStatsRow & { hoursSinceJoin: number; hoursSinceLastSeen: number | null; battlesPerHour: number },
  k: SortKey,
): number | null {
  if (k === "createdAt") return r.hoursSinceJoin;
  if (k === "lastSeenAt") return r.hoursSinceLastSeen;
  if (k === "level") return r.level ?? null;
  if (k === "battleCount") return r.battleCount;
  return r.battlesPerHour;
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

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

type EnrichedRow = AdminStatsRow & {
  hoursSinceJoin: number;
  hoursSinceLastSeen: number | null;
  battlesPerHour: number;
};

function buildSummary(rows: EnrichedRow[]) {
  const count = rows.length;
  const levels = rows.map((r) => r.level ?? 0);
  const battles = rows.map((r) => r.battleCount);
  const bphs = rows.map((r) => r.battlesPerHour).filter((n) => n > 0);
  bphs.sort((a, b) => a - b);
  const median = bphs.length
    ? bphs[Math.floor(bphs.length / 2)]
    : 0;

  // 레벨 히스토그램 최대값 (다른 곳에서 width 계산용)
  const buckets = new Map<number, number>();
  for (const lv of levels) {
    const b = Math.floor(lv / 5) * 5;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const maxBucket = Math.max(1, ...Array.from(buckets.values()));

  return {
    count,
    avgLevel:
      levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : 0,
    avgBattles:
      battles.length > 0
        ? battles.reduce((a, b) => a + b, 0) / battles.length
        : 0,
    medianBph: median,
    maxBph: bphs.length ? bphs[bphs.length - 1] : 0,
    lv30Count: rows.filter((r) => (r.level ?? 0) >= 30).length,
    suspectCount: rows.filter((r) => r.battlesPerHour >= SUSPECT_BPH_THRESHOLD)
      .length,
    activeIn24h: rows.filter(
      (r) => r.hoursSinceLastSeen != null && r.hoursSinceLastSeen <= 24,
    ).length,
    activeIn7d: rows.filter(
      (r) => r.hoursSinceLastSeen != null && r.hoursSinceLastSeen <= 24 * 7,
    ).length,
    maxBucket,
  };
}

function buildLevelHistogram(rows: EnrichedRow[]) {
  const buckets = new Map<number, number>();
  for (const r of rows) {
    const lv = r.level ?? 0;
    const b = Math.floor(lv / 5) * 5;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([b, count]) => ({
      bucket: b,
      label: b === 0 ? "Lv 1~4" : `Lv ${b}~${b + 4}`,
      count,
    }));
}

function buildMilestones(rows: EnrichedRow[]) {
  const thresholds = [10, 20, 30, 40, 50];
  return thresholds.map((threshold) => {
    const reached = rows
      .filter((r) => (r.level ?? 0) >= threshold)
      .map((r) => r.hoursSinceJoin)
      .filter((h) => h > 0)
      .sort((a, b) => a - b);
    if (reached.length === 0) {
      return { threshold, count: 0, p25: null, p50: null, p75: null, min: null };
    }
    const pct = (p: number) =>
      reached[Math.min(reached.length - 1, Math.floor(reached.length * p))];
    return {
      threshold,
      count: reached.length,
      min: reached[0],
      p25: pct(0.25),
      p50: pct(0.5),
      p75: pct(0.75),
    };
  });
}
