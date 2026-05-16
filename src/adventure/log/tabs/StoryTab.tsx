"use client";

import { Card } from "@/components/ui/Card";
import { useChapterProgress } from "@/adventure/story/useChapterProgress";
import type { ChapterStatus } from "@/adventure/story/useChapterProgress";

const ACT_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "1막 — 평범한 모험가",
  2: "2막 — 세 봉인",
  3: "3막 — 노룡의 유언",
  4: "4막 — 옥좌의 길",
};

const STATUS_STYLE: Record<
  ChapterStatus,
  { badge: string; badgeText: string; titleClass: string; summaryClass: string }
> = {
  completed: {
    badge: "bg-emerald-600/20 text-emerald-300 border-emerald-700/40",
    badgeText: "완료",
    titleClass: "text-emerald-200",
    summaryClass: "text-zinc-300",
  },
  current: {
    badge: "bg-amber-500/20 text-amber-200 border-amber-600/40",
    badgeText: "진행 중",
    titleClass: "text-amber-100",
    summaryClass: "text-zinc-200",
  },
  future: {
    badge: "bg-zinc-700/40 text-zinc-400 border-zinc-700/60",
    badgeText: "예정",
    titleClass: "text-zinc-400",
    summaryClass: "text-zinc-500",
  },
  tbd: {
    badge: "bg-zinc-800/60 text-zinc-500 border-zinc-700/60",
    badgeText: "준비 중",
    titleClass: "text-zinc-500",
    summaryClass: "text-zinc-600",
  },
};

export function StoryTab() {
  const { entries, currentChapter, completedCount, totalCount } =
    useChapterProgress();

  // 막별로 그룹화 — 1, 2, 3, 4 순서로 항상 표시.
  const acts: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            메인 스토리 — 옥좌의 부름
          </h2>
          <span className="text-sm text-zinc-400">
            {completedCount} / {totalCount}
          </span>
        </div>
        {currentChapter ? (
          <p className="mt-2 text-sm text-amber-200">
            지금: Ch.{currentChapter.number} {currentChapter.title}
          </p>
        ) : completedCount === totalCount ? (
          <p className="mt-2 text-sm text-emerald-300">
            모든 챕터를 마쳤다. 옥좌의 주재 너머로.
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            현재 진행 중인 챕터 없음 — 다음 콘텐츠 준비 중.
          </p>
        )}
      </Card>

      {acts.map((act) => {
        const actEntries = entries.filter((e) => e.chapter.act === act);
        if (actEntries.length === 0) return null;
        return (
          <div key={act} className="flex flex-col gap-2">
            <h3 className="px-1 text-sm font-semibold text-zinc-400">
              {ACT_LABELS[act]}
            </h3>
            <div className="flex flex-col gap-2">
              {actEntries.map(({ chapter, status }) => {
                const style = STATUS_STYLE[status];
                return (
                  <Card
                    key={chapter.number}
                    className={`p-3 ${
                      status === "current"
                        ? "ring-1 ring-amber-500/40"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-zinc-500">
                            Ch.{chapter.number}
                          </span>
                          <h4
                            className={`text-sm font-medium ${style.titleClass}`}
                          >
                            {chapter.title}
                          </h4>
                        </div>
                        <p className={`mt-1 text-xs ${style.summaryClass}`}>
                          {status === "future" || status === "tbd"
                            ? // 스포일러 방지 — 아직 도달 못한 챕터의 요약은 숨김.
                              status === "tbd"
                              ? "후속 업데이트에서 공개됩니다."
                              : "···"
                            : chapter.summary}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded border px-2 py-0.5 text-[10px] ${style.badge}`}
                      >
                        {style.badgeText}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
