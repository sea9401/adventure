"use client";

import { useState } from "react";
import { Crown, Sword, Trophy } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  useRankings,
  type RankingMetric,
  type RankingEntry,
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

const valueFor = (e: RankingEntry, metric: RankingMetric): number => {
  if (metric === "level") return e.level;
  if (metric === "fame") return e.fame;
  return e.battleCount;
};

export function RankingsView({
  character,
}: {
  character: {
    name: string;
    level: number;
    fame: number;
    battleCount: number;
  };
}) {
  const [metric, setMetric] = useState<RankingMetric>("level");
  const { list, me, loading, error, register, leave } = useRankings(metric);

  const handleRegister = () =>
    register({
      name: character.name,
      level: character.level,
      fame: character.fame,
      battleCount: character.battleCount,
    });

  return (
    <div className="space-y-3">
      <Card as="section" padding="md">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          모험가 명부에 등록한 사람만 표시됩니다. 등록 시 현재 캐릭터의 레벨,
          명성, 전투 횟수가 스냅샷으로 기록되며 갱신은 수동입니다.
        </p>
      </Card>

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
        <Card as="section" padding="md">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            불러오는 중…
          </p>
        </Card>
      ) : !list || list.length === 0 ? (
        <EmptyState
          icon={<Trophy size={40} weight="duotone" />}
          title="아직 등록된 사람이 없습니다"
          message="첫 번째로 모험가 명부에 이름을 올려보세요."
        />
      ) : (
        <Card as="section" padding="none">
          <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.map((e) => (
              <li
                key={`${e.rank}-${e.name}`}
                className={`flex items-center justify-between gap-3 px-4 py-2 ${
                  e.mine
                    ? "bg-emerald-50 dark:bg-emerald-950/40"
                    : ""
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <RankBadge rank={e.rank} />
                  <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {e.name}
                    {e.mine && (
                      <span className="ml-1 text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
                        (나)
                      </span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-zinc-700 dark:text-zinc-200">
                  {METRIC_LABEL[metric]} {valueFor(e, metric)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card as="section" padding="md">
        {me === null ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            본인 상태 확인 중…
          </p>
        ) : me.registered ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
                <Crown
                  size={18}
                  weight="duotone"
                  className="text-amber-500"
                />
                내 등록 정보
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                Lv.{me.level} · 명성 {me.fame} · 전투 {me.battleCount}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRegister}
                className="flex-1 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                갱신
              </button>
              <button
                type="button"
                onClick={leave}
                className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                랭킹에서 빠지기
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              모험가 명부에 등록되어 있지 않습니다.
            </p>
            <button
              type="button"
              onClick={handleRegister}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <Sword size={16} weight="duotone" />
              명부에 이름 올리기
            </button>
          </div>
        )}
      </Card>
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
