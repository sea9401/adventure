"use client";

import { useState, type ReactNode } from "react";
import { Diamond, MapPin, Sword, User } from "@phosphor-icons/react";

type LogTabKey = "monsters" | "items" | "npcs" | "towns";

const LOG_TABS: { key: LogTabKey; label: string }[] = [
  { key: "monsters", label: "몬스터" },
  { key: "items", label: "아이템" },
  { key: "npcs", label: "NPC" },
  { key: "towns", label: "마을" },
];

const EMPTY_BY_TAB: Record<
  LogTabKey,
  { icon: ReactNode; title: string; message: string }
> = {
  monsters: {
    icon: <Sword size={40} weight="duotone" />,
    title: "아직 기록된 몬스터가 없습니다",
    message: "전투에서 적을 처음 만나면 도감에 등록됩니다.",
  },
  items: {
    icon: <Diamond size={40} weight="duotone" />,
    title: "아직 기록된 아이템이 없습니다",
    message: "획득·장착한 아이템이 여기에 모입니다.",
  },
  npcs: {
    icon: <User size={40} weight="duotone" />,
    title: "아직 기록된 NPC가 없습니다",
    message: "마을 사람들과 이야기하면 인물 노트가 쌓입니다.",
  },
  towns: {
    icon: <MapPin size={40} weight="duotone" />,
    title: "아직 기록된 마을이 없습니다",
    message: "마을을 방문하면 안내문이 추가됩니다.",
  },
};

export function AdventureLogView() {
  const [tab, setTab] = useState<LogTabKey>("monsters");
  const empty = EMPTY_BY_TAB[tab];

  return (
    <div className="space-y-3">
      <nav
        role="tablist"
        aria-label="모험의 서 탭"
        className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800"
      >
        {LOG_TABS.map((t) => {
          const selected = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={selected}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <section className="rounded-lg border border-dashed border-zinc-300 bg-white/40 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
        <div className="mx-auto inline-flex text-zinc-400 dark:text-zinc-500">
          {empty.icon}
        </div>
        <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
          {empty.title}
        </div>
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {empty.message}
        </div>
      </section>
    </div>
  );
}
