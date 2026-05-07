"use client";

import { Coins, Scroll, Star } from "@phosphor-icons/react";
import { getQuestsForRegion, type Quest } from "./data/quests";
import type { RegionId } from "./data/world";
import type { QuestProgressEntry } from "./quests/storage";

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
  const quests = getQuestsForRegion(regionId);

  if (quests.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/90">
        <Scroll
          size={40}
          weight="duotone"
          className="mx-auto text-zinc-400 dark:text-zinc-500"
        />
        <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
          게시된 의뢰가 없습니다
        </div>
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          이 마을의 길드에는 아직 받을 수 있는 의뢰가 없습니다.
        </div>
      </section>
    );
  }

  return (
    <ul className="space-y-2">
      {quests.map((q) => (
        <QuestCard
          key={q.id}
          quest={q}
          entry={getEntry(q.id)}
          characterLevel={characterLevel}
          onAccept={() => onAccept(q.id)}
          onClaim={() => onClaim(q.id)}
        />
      ))}
    </ul>
  );
}

function QuestCard({
  quest,
  entry,
  characterLevel,
  onAccept,
  onClaim,
}: {
  quest: Quest;
  entry: QuestProgressEntry;
  characterLevel: number;
  onAccept: () => void;
  onClaim: () => void;
}) {
  const meetsLevel = characterLevel >= quest.requiredLevel;
  const targetCount = quest.target.count;
  const pct = Math.min(1, entry.progress / targetCount);

  let actionLabel: string;
  let actionDisabled = false;
  let actionHandler: () => void = () => {};
  let actionVariant: "default" | "ready" = "default";

  if (entry.state === "available") {
    actionLabel = meetsLevel ? "수주하기" : `Lv.${quest.requiredLevel} 필요`;
    actionDisabled = !meetsLevel;
    actionHandler = onAccept;
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
    <li className="rounded-lg border border-zinc-200 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/90">
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
          <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
            <Coins size={14} weight="fill" className="text-yellow-500" />
            <span className="tabular-nums">{quest.reward.gold}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-200">
            <Star size={14} weight="fill" className="text-amber-500" />
            <span className="tabular-nums">명성 {quest.reward.fame}</span>
          </span>
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
    </li>
  );
}
