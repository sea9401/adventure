"use client";

import { useState } from "react";
import { CaretDown, CaretRight, MapPin } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { NPCS } from "@/adventure/data/npcs";
import { WORLD_MAP } from "@/adventure/data/world";
import { NpcAvatar } from "@/adventure/NpcAvatar";
import type { AdventureLog } from "@/adventure/log/storage";
import { ROLE_LABEL, relativeTime } from "./shared";

// 마을별 인연 회고 — 첫 방문, 대화한 NPC 목록, 가장 자주 만난 사람.
export function TownsTab({ log }: { log: AdventureLog }) {
  const towns = WORLD_MAP.regions.filter(
    (r) => r.tags?.includes("town") && log.towns[r.id]?.visited,
  );
  const pager = usePagination(towns, 10);
  if (towns.length === 0) {
    return (
      <EmptyState
        icon={<MapPin size={40} weight="duotone" />}
        title="아직 기록된 마을이 없습니다"
        message="마을을 방문하면 안내문이 추가됩니다."
      />
    );
  }
  return (
    <div className="space-y-2">
      {pager.pageItems.map((r) => (
        <TownCard key={r.id} region={r} log={log} />
      ))}
      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        setPage={pager.setPage}
      />
    </div>
  );
}

function TownCard({
  region,
  log,
}: {
  region: (typeof WORLD_MAP.regions)[number];
  log: AdventureLog;
}) {
  const [open, setOpen] = useState(false);
  const town = log.towns[region.id];
  const npcEntries = NPCS.filter((n) => n.region === region.id).map((npc) => ({
    npc,
    entry: log.npcs[npc.id],
  }));
  const totalNpcs = npcEntries.length;
  const talked = npcEntries.filter(
    (e) => (e.entry?.talkCount ?? 0) > 0,
  ).length;
  const totalTalks = npcEntries.reduce(
    (a, e) => a + (e.entry?.talkCount ?? 0),
    0,
  );
  const sorted = [...npcEntries].sort(
    (a, b) => (b.entry?.talkCount ?? 0) - (a.entry?.talkCount ?? 0),
  );
  const topTalker =
    sorted[0] && (sorted[0].entry?.talkCount ?? 0) > 0 ? sorted[0] : null;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-mx-1 -my-0.5 flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
      >
        <span className="flex items-center gap-1.5">
          {open ? (
            <CaretDown size={14} className="text-zinc-400" />
          ) : (
            <CaretRight size={14} className="text-zinc-400" />
          )}
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {region.name}
          </span>
        </span>
        {region.recommendedLevel !== undefined && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            적정 Lv.{region.recommendedLevel}
          </span>
        )}
      </button>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        {region.description}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span>첫 방문 {relativeTime(town?.firstVisitedAt)}</span>
        {totalNpcs > 0 && (
          <>
            <span>
              만난 사람 {talked} / {totalNpcs}
            </span>
            <span>총 대화 {totalTalks.toLocaleString()}회</span>
            {topTalker && (
              <span>가장 자주 만난 이: {topTalker.npc.name}</span>
            )}
          </>
        )}
      </div>
      {open && totalNpcs > 0 && (
        <ul className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          {sorted.map((e) => {
            const count = e.entry?.talkCount ?? 0;
            const isTop = topTalker?.npc.id === e.npc.id;
            return (
              <li
                key={e.npc.id}
                className={
                  "flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs " +
                  (isTop ? "bg-amber-50 dark:bg-amber-950/30" : "")
                }
              >
                <span className="flex items-center gap-2">
                  <NpcAvatar npc={e.npc} size={20} />
                  <span
                    className={
                      count > 0
                        ? "text-zinc-800 dark:text-zinc-200"
                        : "text-zinc-400 dark:text-zinc-600"
                    }
                  >
                    {e.npc.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    [{ROLE_LABEL[e.npc.role]}]
                  </span>
                </span>
                <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  {count > 0 ? (
                    <>
                      <span className="tabular-nums">{count.toLocaleString()}회</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        · 처음 {relativeTime(e.entry?.firstTalkAt)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px]">미대면</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
