"use client";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useArenaStats, type ArenaStatsResponse } from "./useArena";

const PEAK_AT_FMT = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

export function StatsView() {
  const { stats, loading, error } = useArenaStats();

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-20" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-center text-xs text-rose-600 dark:text-rose-400">
        통계를 불러오지 못했습니다: {error}
      </p>
    );
  }
  if (!stats) return null;

  const hasMatches = stats.timeline.length > 0;
  if (!hasMatches) {
    return (
      <Card padding="sm">
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          이번 시즌 매치 기록이 없어요. 첫 도전을 해 보세요.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <RatingChartCard timeline={stats.timeline} peak={stats.peak} />
      <div className="grid grid-cols-2 gap-3">
        <PeakCard peak={stats.peak} />
        <StreakCard streak={stats.currentStreak} />
      </div>
      <FrequentOpponentsCard opponents={stats.frequentOpponents} />
    </div>
  );
}

// ── Rating sparkline ────────────────────────────────────────────────────

function RatingChartCard({
  timeline,
  peak,
}: {
  timeline: ArenaStatsResponse["timeline"];
  peak: ArenaStatsResponse["peak"];
}) {
  const values = timeline.map((p) => p.ratingAfter);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <Card padding="sm">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          Rating 추이
        </h3>
        <span className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
          {timeline.length}매치 · {min}–{max}
        </span>
      </div>
      <RatingSparkline values={values} peakValue={peak?.rating ?? null} />
    </Card>
  );
}

// 의존성 없는 인라인 SVG sparkline. preserveAspectRatio=none 으로 컨테이너 너비에 stretch —
// 점 갯수에 무관하게 균등 분포. peak 자리에 작은 도트 강조.
function RatingSparkline({
  values,
  peakValue,
}: {
  values: number[];
  peakValue: number | null;
}) {
  const W = 100;
  const H = 30;
  if (values.length === 1) {
    // 매치 1건 — 가운데 점 하나로 표현.
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-20 w-full text-rose-500 dark:text-rose-400"
        aria-hidden
      >
        <circle cx={W / 2} cy={H / 2} r="1.5" fill="currentColor" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return [x, y] as const;
  });
  const polyline = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  // peak 인덱스 — 동률 다수면 가장 최근. 시각화는 마지막 매치 우선.
  let peakIdx = -1;
  if (peakValue !== null) {
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] === peakValue) {
        peakIdx = i;
        break;
      }
    }
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-20 w-full text-rose-500 dark:text-rose-400"
      aria-hidden
    >
      {/* 0-축 (min) 가이드라인 */}
      <line
        x1="0"
        y1={H}
        x2={W}
        y2={H}
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="0.4"
      />
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {peakIdx >= 0 && (
        <circle
          cx={pts[peakIdx][0]}
          cy={pts[peakIdx][1]}
          r="1.6"
          className="text-amber-500 dark:text-amber-400"
          fill="currentColor"
        />
      )}
    </svg>
  );
}

// ── Peak / Streak 2-열 카드 ──────────────────────────────────────────────

function PeakCard({ peak }: { peak: ArenaStatsResponse["peak"] }) {
  return (
    <Card padding="sm">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        시즌 피크
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
        {peak ? peak.rating : "—"}
      </p>
      {peak && (
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {PEAK_AT_FMT.format(new Date(peak.at))}
        </p>
      )}
    </Card>
  );
}

function StreakCard({
  streak,
}: {
  streak: ArenaStatsResponse["currentStreak"];
}) {
  const cfg =
    streak.kind === "win"
      ? {
          label: "연승",
          color: "text-emerald-600 dark:text-emerald-400",
          symbol: "W",
        }
      : streak.kind === "loss"
        ? {
            label: "연패",
            color: "text-rose-600 dark:text-rose-400",
            symbol: "L",
          }
        : streak.kind === "draw"
          ? {
              label: "연속 무승부",
              color: "text-zinc-500 dark:text-zinc-400",
              symbol: "D",
            }
          : {
              label: "스트릭",
              color: "text-zinc-400 dark:text-zinc-500",
              symbol: "—",
            };
  return (
    <Card padding="sm">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {cfg.label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${cfg.color}`}>
        {streak.kind === "none" ? "—" : `${cfg.symbol}${streak.count}`}
      </p>
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
        {streak.kind === "none" ? "도전 없음" : "현재 흐름"}
      </p>
    </Card>
  );
}

// ── 자주 만난 상대 ──────────────────────────────────────────────────────

function FrequentOpponentsCard({
  opponents,
}: {
  opponents: ArenaStatsResponse["frequentOpponents"];
}) {
  return (
    <Card padding="sm">
      <h3 className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
        자주 만난 상대
      </h3>
      {opponents.length === 0 ? (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          아직 정보 없음
        </p>
      ) : (
        <ul className="space-y-1">
          {opponents.map((o) => {
            const winRate =
              o.matches > 0 ? Math.round((o.wins / o.matches) * 100) : 0;
            return (
              <li
                key={o.userId}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-2 truncate text-zinc-700 dark:text-zinc-200">
                  <span className="truncate">{o.name}</span>
                  {o.isBot && (
                    <span className="rounded bg-zinc-200 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      BOT
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                  {o.matches}회 ·{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {o.wins}
                  </span>
                  -
                  <span className="text-rose-600 dark:text-rose-400">
                    {o.losses}
                  </span>
                  {o.draws > 0 && (
                    <>
                      -<span>{o.draws}</span>
                    </>
                  )}
                  <span className="ml-1 text-[10px] text-zinc-400">
                    ({winRate}%)
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
