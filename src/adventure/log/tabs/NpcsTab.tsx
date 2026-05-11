"use client";

import { useState } from "react";
import { User } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { NPCS } from "@/adventure/data/npcs";
import { WORLD_MAP } from "@/adventure/data/world";
import { NpcAvatar } from "@/adventure/NpcAvatar";
import type { AdventureLog } from "@/adventure/log/storage";
import { ROLE_LABEL } from "./shared";

export function NpcsTab({ log }: { log: AdventureLog }) {
  const talked = NPCS.filter((n) => (log.npcs[n.id]?.talkCount ?? 0) > 0);
  // 대화한 NPC 가 한 명이라도 있는 마을만 하위 탭으로 노출.
  const townTabs = WORLD_MAP.regions
    .filter((r) => r.tags?.includes("town"))
    .filter((r) => talked.some((n) => n.region === r.id))
    .map((r) => ({ key: r.id, label: r.name }));
  const [regionTab, setRegionTab] = useState<string>(
    () => townTabs[0]?.key ?? "",
  );

  // 새 마을이 추가됐는데 이전 선택이 무효화된 경우 첫 탭으로 폴백 (state 는 안 건드림).
  const activeTab = townTabs.some((t) => t.key === regionTab)
    ? regionTab
    : (townTabs[0]?.key ?? "");
  const inTown = talked.filter((n) => n.region === activeTab);
  const pager = usePagination(inTown, 10);

  if (talked.length === 0) {
    return (
      <EmptyState
        icon={<User size={40} weight="duotone" />}
        title="아직 기록된 NPC가 없습니다"
        message="마을 사람들과 이야기하면 인물 노트가 쌓입니다."
      />
    );
  }

  return (
    <div className="space-y-3">
      <TabBar
        tabs={townTabs}
        active={activeTab}
        onChange={setRegionTab}
        ariaLabel="NPC 마을 필터"
        size="sm"
        scrollable
      />
      <div className="space-y-2">
        {pager.pageItems.map((n) => {
          const entry = log.npcs[n.id]!;
          return (
            <Card key={n.id}>
              <div className="flex items-start gap-3">
                <NpcAvatar npc={n} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {n.name}
                      <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                        {ROLE_LABEL[n.role]}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {entry.talkCount}회
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {n.description}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount}
          setPage={pager.setPage}
        />
      </div>
    </div>
  );
}
