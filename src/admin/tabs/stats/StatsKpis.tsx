"use client";

import { useMemo } from "react";
import type { EnrichedRow } from "./useAdminStats";
import { SUSPECT_BPH_THRESHOLD } from "./useAdminStats";

function formatHours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)}분`;
  if (h < 24) return `${h.toFixed(1)}시간`;
  return `${Math.floor(h / 24)}일`;
}

// 상단 KPI 카드 그리드 — "유저 진척 통계" 섹션 안에 들어간다.
export function StatsKpiCards({ rows }: { rows: EnrichedRow[] }) {
  const summary = useMemo(() => buildSummary(rows), [rows]);
  return (
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
      <Card label="의심(시간당 ≥ 30전)" value={`${summary.suspectCount}명`} />
      <Card label="최근 24h 활동" value={`${summary.activeIn24h}명`} />
      <Card label="최근 7d 활동" value={`${summary.activeIn7d}명`} />
    </div>
  );
}

// 마일스톤 도달 시간 분포 + 레벨 히스토그램 — 각각 독립 섹션.
export function StatsDistributions({ rows }: { rows: EnrichedRow[] }) {
  const summary = useMemo(() => buildSummary(rows), [rows]);
  const levelHistogram = useMemo(() => buildLevelHistogram(rows), [rows]);
  const milestones = useMemo(() => buildMilestones(rows), [rows]);

  return (
    <>
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
    </>
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

function buildSummary(rows: EnrichedRow[]) {
  const count = rows.length;
  const levels = rows.map((r) => r.level ?? 0);
  const battles = rows.map((r) => r.battleCount);
  const bphs = rows.map((r) => r.battlesPerHour).filter((n) => n > 0);
  bphs.sort((a, b) => a - b);
  const median = bphs.length ? bphs[Math.floor(bphs.length / 2)] : 0;

  // 레벨 히스토그램 최대값 (width 계산용)
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
