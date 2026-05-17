"use client";

import { useEffect, useState } from "react";
import { Coins, Scroll, Star } from "@phosphor-icons/react";
import { type KillQuest } from "./data/quests";
import type { RegionId } from "./data/world";
import type { QuestProgressEntry } from "./quests/storage";
import { cooldownStatus } from "./quests/cooldown";
import { getBoardQuestsForRegion } from "./quests/board";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { formatDuration } from "@/lib/format";

export function GuildView({
  regionId,
  characterLevel,
  getEntry,
  onAccept,
  onClaim,
}: {
  regionId: RegionId;
  characterLevel: number;
  getEntry: (id: string) => QuestProgressEntry;
  onAccept: (id: string) => void;
  onClaim: (id: string) => void;
}) {
  // 게시판은 매일 5개로 캡 (board.ts) — 선행 충족 / 비반복 완료 제외는 그쪽에서 처리.
  // active/ready 의뢰는 5개 캡과 무관하게 항상 노출.
  const quests = getBoardQuestsForRegion(regionId, getEntry);
  const [now, setNow] = useState(() => Date.now());

  // 쿨다운 중인 카드가 하나라도 있을 때만 분 단위 tick.
  const anyOnCooldown = quests.some((q) =>
    cooldownStatus(q, getEntry(q.id), now).onCooldown,
  );
  useEffect(() => {
    if (!anyOnCooldown) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [anyOnCooldown]);

  const pager = usePagination(quests, 10);

  if (quests.length === 0) {
    return (
      <EmptyState
        icon={<Scroll size={40} weight="duotone" />}
        title="게시된 의뢰가 없습니다"
        message="이 마을의 길드에는 아직 받을 수 있는 의뢰가 없습니다."
      />
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {pager.pageItems.map((q) => (
          <QuestCard
            key={q.id}
            quest={q}
            entry={getEntry(q.id)}
            characterLevel={characterLevel}
            now={now}
            onAccept={() => onAccept(q.id)}
            onClaim={() => onClaim(q.id)}
          />
        ))}
      </ul>
      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        setPage={pager.setPage}
      />
    </>
  );
}

function QuestCard({
  quest,
  entry,
  characterLevel,
  now,
  onAccept,
  onClaim,
}: {
  quest: KillQuest;
  entry: QuestProgressEntry;
  characterLevel: number;
  now: number;
  onAccept: () => void;
  onClaim: () => void;
}) {
  const meetsLevel = characterLevel >= quest.requiredLevel;
  const targetCount = quest.target.count;
  const pct = Math.min(1, entry.progress / targetCount);
  const cd = cooldownStatus(quest, entry, now);

  let actionLabel: string;
  let actionDisabled = false;
  let actionHandler: () => void = () => {};
  let actionVariant: "default" | "ready" = "default";

  if (entry.state === "available") {
    if (cd.onCooldown) {
      actionLabel = `재의뢰 ${formatDuration(cd.remaining)}`;
      actionDisabled = true;
    } else if (!meetsLevel) {
      actionLabel = `Lv.${quest.requiredLevel} 필요`;
      actionDisabled = true;
    } else {
      actionLabel = "수락";
      actionHandler = onAccept;
    }
  } else if (entry.state === "active") {
    actionLabel = `진행 중 ${entry.progress}/${targetCount}`;
    actionDisabled = true;
  } else if (entry.state === "ready") {
    actionLabel = "보상 받기";
    actionHandler = onClaim;
    actionVariant = "ready";
  } else {
    actionLabel = "완료";
    actionDisabled = true;
  }

  return (
    <Card as="li" padding="md">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scroll size={18} weight="duotone" className="text-yellow-700" />
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {quest.title}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {quest.repeatable && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">
              반복
            </span>
          )}
          <span className="text-zinc-500 dark:text-zinc-400">
            Lv.{quest.requiredLevel}+
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {quest.description}
      </p>

      {entry.state !== "available" && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{quest.target.monsterName} 처치</span>
            <span className="tabular-nums">
              {entry.progress}/{targetCount}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {(quest.reward.gold ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
              <Coins size={14} weight="fill" className="text-yellow-500" />
              <span className="tabular-nums">{(quest.reward.gold ?? 0).toLocaleString()}</span>
            </span>
          )}
          {(quest.reward.fame ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
              <Star size={14} weight="fill" className="text-amber-500" />
              <span className="tabular-nums">명성 {(quest.reward.fame ?? 0).toLocaleString()}</span>
            </span>
          )}
          {entry.completedCount > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              완료 {entry.completedCount}회
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={actionHandler}
          disabled={actionDisabled}
          className={
            actionVariant === "ready"
              ? "shrink-0 rounded-md border border-emerald-500 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:border-emerald-400 dark:text-emerald-300"
              : "shrink-0 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }
        >
          {actionLabel}
        </button>
      </div>
    </Card>
  );
}
