"use client";

import { useState, type ReactNode } from "react";
import { ClipboardText, Coins, Scroll, Star } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { formatRelative } from "@/lib/notifications";
import { QUESTS, type Quest } from "@/adventure/data/quests";
import { NPCS } from "@/adventure/data/npcs";
import { WORLD_MAP } from "@/adventure/data/world";
import { MATERIALS } from "@/adventure/data/materials";
import type { QuestProgressEntry } from "./storage";

const REGION_NAMES = new Map(WORLD_MAP.regions.map((r) => [r.id, r.name]));
const NPC_NAMES = new Map(NPCS.map((n) => [n.id, n.name]));

type Tab = "active" | "completed";

export function QuestJournalView({
  getEntry,
}: {
  getEntry: (id: string) => QuestProgressEntry;
}) {
  const [tab, setTab] = useState<Tab>("active");

  const active = QUESTS.filter((q) => {
    const e = getEntry(q.id);
    return e.state === "active" || e.state === "ready";
  });

  const completed = QUESTS.filter((q) => {
    const e = getEntry(q.id);
    return e.state === "completed" || e.completedCount > 0;
  });

  const list = tab === "active" ? active : completed;
  const pager = usePagination(list, 15);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/60">
        <TabButton
          label={`진행 중 ${active.length}`}
          active={tab === "active"}
          onClick={() => setTab("active")}
        />
        <TabButton
          label={`완료 ${completed.length}`}
          active={tab === "completed"}
          onClick={() => setTab("completed")}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<ClipboardText size={40} weight="duotone" />}
          title={
            tab === "active"
              ? "진행 중인 의뢰가 없습니다"
              : "아직 완료한 의뢰가 없습니다"
          }
          message={
            tab === "active"
              ? "길드 게시판이나 마을 사람들에게서 새 의뢰를 받아 보세요."
              : "의뢰를 완료하면 여기에 기록됩니다."
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {pager.pageItems.map((q) => (
              <JournalCard
                key={q.id}
                quest={q}
                entry={getEntry(q.id)}
                tab={tab}
              />
            ))}
          </ul>
          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            setPage={pager.setPage}
          />
        </>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex-1 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
          : "flex-1 rounded-md px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      }
    >
      {label}
    </button>
  );
}

function JournalCard({
  quest,
  entry,
  tab,
}: {
  quest: Quest;
  entry: QuestProgressEntry;
  tab: Tab;
}) {
  const regionName = REGION_NAMES.get(quest.regionId) ?? quest.regionId;
  const giverName = quest.giverNpcId
    ? (NPC_NAMES.get(quest.giverNpcId) ?? null)
    : null;

  const meta: string[] = [regionName];
  if (giverName) meta.push(`의뢰인 ${giverName}`);

  return (
    <Card as="li" padding="md">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scroll size={18} weight="duotone" className="text-yellow-700" />
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {quest.title}
          </h3>
        </div>
        {tab === "active" && entry.state === "ready" && (
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            보상 대기
          </span>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        {meta.map((m, i) => (
          <span key={m} className="inline-flex items-center gap-2">
            {i > 0 && <span aria-hidden>·</span>}
            <span>{m}</span>
          </span>
        ))}
      </div>

      {tab === "active" && (
        <>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {quest.description}
          </p>

          {quest.target.kind === "kill" ? (
            <KillProgress
              monsterName={quest.target.monsterName}
              progress={entry.progress}
              count={quest.target.count}
            />
          ) : (
            <DeliverHint
              materialName={MATERIALS[quest.target.materialId].name}
              count={quest.target.count}
              giverName={giverName}
            />
          )}

          <RewardLine quest={quest} />
        </>
      )}

      {tab === "completed" && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {entry.completedCount > 0 && (
            <span>완료 {entry.completedCount}회</span>
          )}
          {entry.lastCompletedAt && (
            <span className="text-zinc-400 dark:text-zinc-500">
              마지막 완료 {formatRelative(entry.lastCompletedAt)}
            </span>
          )}
          {quest.repeatable && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">
              반복
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function KillProgress({
  monsterName,
  progress,
  count,
}: {
  monsterName: string;
  progress: number;
  count: number;
}) {
  const shown = Math.min(progress, count);
  const pct = Math.min(1, progress / count);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{monsterName} 처치</span>
        <span className="tabular-nums">
          {shown}/{count}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

function DeliverHint({
  materialName,
  count,
  giverName,
}: {
  materialName: string;
  count: number;
  giverName: string | null;
}) {
  return (
    <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
      {materialName} {count}개를 모아 {giverName ?? "의뢰인"}에게 전달
    </div>
  );
}

function RewardLine({ quest }: { quest: Quest }) {
  const chips: ReactNode[] = [];
  const r = quest.reward;
  if ((r.gold ?? 0) > 0) {
    chips.push(
      <span key="gold" className="inline-flex items-center gap-1">
        <Coins size={14} weight="fill" className="text-yellow-500" />
        <span className="tabular-nums">{r.gold}</span>
      </span>,
    );
  }
  if ((r.fame ?? 0) > 0) {
    chips.push(
      <span key="fame" className="inline-flex items-center gap-1">
        <Star size={14} weight="fill" className="text-amber-500" />
        <span className="tabular-nums">명성 {r.fame}</span>
      </span>,
    );
  }
  if ((r.exp ?? 0) > 0) {
    chips.push(
      <span key="exp" className="tabular-nums text-zinc-600 dark:text-zinc-300">
        EXP {r.exp}
      </span>,
    );
  }
  const extras: string[] = [];
  if (r.items?.length) extras.push(`아이템 ${r.items.length}종`);
  if (r.recipes?.length) extras.push(`제작서 ${r.recipes.length}장`);
  if (r.potions?.length) extras.push(`포션 ${r.potions.length}종`);
  if (r.materials?.length) extras.push(`재료 ${r.materials.length}종`);
  if ((r.potionCapacityBonus ?? 0) > 0)
    extras.push(`포션 슬롯 +${r.potionCapacityBonus}`);
  for (const e of extras) {
    chips.push(
      <span key={e} className="text-zinc-600 dark:text-zinc-300">
        {e}
      </span>,
    );
  }

  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-700 dark:text-zinc-200">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">보상</span>
      {chips}
    </div>
  );
}
