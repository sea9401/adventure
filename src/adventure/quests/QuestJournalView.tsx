"use client";

import { useState, type ReactNode } from "react";
import { ClipboardText, Coins, Scroll, Star } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { formatRelative } from "@/lib/notifications";
import { QUESTS, questTargetTotal, type Quest } from "@/adventure/data/quests";
import { NPCS } from "@/adventure/data/npcs";
import { WORLD_MAP } from "@/adventure/data/world";
import { MATERIALS } from "@/adventure/data/materials";
import { ITEMS } from "@/adventure/data/items";
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
  const pager = usePagination(list, 10);

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

          <TargetView quest={quest} entry={entry} giverName={giverName} />

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

// 의뢰 타겟 한 종류에 맞춰 진행 안내를 그린다. 누적형(kill/craft/talk N 회 등) 은 진행 바,
// 일회형/deliver/equip 은 한 줄 힌트. 타겟 종류가 늘어나면 여기서 분기 추가.
function TargetView({
  quest,
  entry,
  giverName,
}: {
  quest: Quest;
  entry: QuestProgressEntry;
  giverName: string | null;
}) {
  const t = quest.target;
  const total = questTargetTotal(t);
  switch (t.kind) {
    case "kill":
      return <ProgressBar label={`${t.monsterName} 처치`} progress={entry.progress} count={total} />;
    case "kill_within_hp":
      return (
        <ProgressBar
          label={`${t.monsterName} 처치 (HP ${Math.round(t.minHpFraction * 100)}% 이상 유지)`}
          progress={entry.progress}
          count={total}
        />
      );
    case "no_potion_boss":
      return (
        <ProgressBar
          label={`${t.monsterName} 처치 (포션 없이)`}
          progress={entry.progress}
          count={total}
        />
      );
    case "deliver":
      return (
        <Hint>
          {MATERIALS[t.materialId].name} {total}개를 모아 {giverName ?? "의뢰인"}에게 전달
        </Hint>
      );
    case "talk_to_npc": {
      const name = NPC_NAMES.get(t.npcId) ?? t.npcId;
      return total > 1 ? (
        <ProgressBar label={`${name} 와(과) 대화`} progress={entry.progress} count={total} />
      ) : (
        <Hint>{name} 와(과) 대화</Hint>
      );
    }
    case "visit_region": {
      const name = REGION_NAMES.get(t.regionId) ?? t.regionId;
      return total > 1 ? (
        <ProgressBar label={`${name} 방문`} progress={entry.progress} count={total} />
      ) : (
        <Hint>{name} 에 들른다</Hint>
      );
    }
    case "craft_item":
      return (
        <ProgressBar
          label={`${ITEMS[t.itemId].name} 제작`}
          progress={entry.progress}
          count={total}
        />
      );
    case "equip_item":
      return <Hint>{ITEMS[t.itemId].name} 을(를) 한 번이라도 장착</Hint>;
    case "equip_set": {
      const names = t.itemIds.map((id) => ITEMS[id].name).join(" · ");
      return (
        <ProgressBar
          label={`한 복 장착 — ${names}`}
          progress={entry.progress}
          count={total}
        />
      );
    }
  }
}

function ProgressBar({
  label,
  progress,
  count,
}: {
  label: string;
  progress: number;
  count: number;
}) {
  const shown = Math.min(progress, count);
  const pct = count > 0 ? Math.min(1, progress / count) : 0;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{label}</span>
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

function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{children}
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
