"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminProvider, useAdmin } from "./AdminContext";
import { OverviewTab } from "./tabs/OverviewTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { QuestsTab } from "./tabs/QuestsTab";
import { CraftingTab } from "./tabs/CraftingTab";
import { LogTab } from "./tabs/LogTab";
import { MapTab } from "./tabs/MapTab";
import { RunesTab } from "./tabs/RunesTab";
import { DataTab } from "./tabs/DataTab";
import { UsersTab } from "./tabs/UsersTab";
import { StatsTab } from "./tabs/StatsTab";
import { MarketplaceTab } from "./tabs/MarketplaceTab";
import { CoopTab } from "./tabs/CoopTab";
import { GuildsTab } from "./tabs/GuildsTab";

type TabKey =
  | "overview"
  | "users"
  | "stats"
  | "marketplace"
  | "coop"
  | "guilds"
  | "inventory"
  | "quests"
  | "crafting"
  | "log"
  | "map"
  | "runes"
  | "data";

type TabGroup = "system" | "edit" | "data";

const TABS: { key: TabKey; label: string; group: TabGroup }[] = [
  { key: "overview", label: "개요", group: "system" },
  { key: "users", label: "유저", group: "system" },
  { key: "stats", label: "통계", group: "system" },
  { key: "marketplace", label: "거래소", group: "system" },
  { key: "coop", label: "협동 보스", group: "system" },
  { key: "guilds", label: "길드 의뢰", group: "system" },
  { key: "inventory", label: "인벤토리", group: "edit" },
  { key: "quests", label: "퀘스트", group: "edit" },
  { key: "crafting", label: "제작", group: "edit" },
  { key: "log", label: "모험의 서", group: "edit" },
  { key: "map", label: "지도", group: "edit" },
  { key: "runes", label: "룬", group: "edit" },
  { key: "data", label: "데이터", group: "data" },
];

const GROUP_LABELS: Record<TabGroup, string> = {
  system: "시스템",
  edit: "본인 디버그",
  data: "참고",
};

// 인접 동일 그룹 묶기 — 사이드바 그룹 헤더용. 순서는 TABS 정의 순 그대로.
function groupTabs<T extends { group: TabGroup }>(
  tabs: T[],
): { group: TabGroup; items: T[] }[] {
  const out: { group: TabGroup; items: T[] }[] = [];
  for (const t of tabs) {
    const last = out[out.length - 1];
    if (last && last.group === t.group) last.items.push(t);
    else out.push({ group: t.group, items: [t] });
  }
  return out;
}

function ShellInner() {
  const [tab, setTab] = useState<TabKey>("overview");
  const { readOnly, setReadOnly, toast } = useAdmin();
  const groups = groupTabs(TABS);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              ← 게임으로
            </Link>
            <h1 className="text-base font-semibold">관리자 도구</h1>
            <span className="rounded bg-zinc-200 px-2 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              dev
            </span>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span>{readOnly ? "🔒 보기 전용" : "✏️ 편집 가능"}</span>
          </label>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          ⚠️ 이 페이지는 게임 진행 상태를 직접 변경합니다. 먼저{" "}
          <strong>전체 백업</strong>을 받으세요. 변경 후 게임 라우트는 새로고침이
          필요할 수 있습니다.
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-12 md:flex-row">
        <nav className="md:w-48 md:shrink-0">
          {/* 모바일: 그룹 헤더 숨기고 가로 스크롤 / 데스크탑: 세로 + 그룹 헤더 */}
          <ul className="flex flex-row flex-wrap gap-1 md:hidden">
            {TABS.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={
                    tab === t.key
                      ? "rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-left text-sm font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "rounded-md border border-transparent px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden flex-col gap-3 md:flex">
            {groups.map(({ group, items }) => (
              <div key={group}>
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {GROUP_LABELS[group]}
                </div>
                <ul className="flex flex-col gap-0.5">
                  {items.map((t) => (
                    <li key={t.key}>
                      <button
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={
                          tab === t.key
                            ? "w-full rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-left text-sm font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                            : "w-full rounded-md border border-transparent px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }
                      >
                        {t.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <main className="flex-1 space-y-4">
          {tab === "overview" && <OverviewTab />}
          {tab === "users" && <UsersTab />}
          {tab === "stats" && <StatsTab />}
          {tab === "marketplace" && <MarketplaceTab />}
          {tab === "coop" && <CoopTab />}
          {tab === "guilds" && <GuildsTab />}
          {tab === "inventory" && <InventoryTab />}
          {tab === "quests" && <QuestsTab />}
          {tab === "crafting" && <CraftingTab />}
          {tab === "log" && <LogTab />}
          {tab === "map" && <MapTab />}
          {tab === "runes" && <RunesTab />}
          {tab === "data" && <DataTab />}
        </main>
      </div>

      {toast ? (
        <div className="fixed bottom-4 right-4 z-40 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export function AdminShell() {
  return (
    <AdminProvider>
      <ShellInner />
    </AdminProvider>
  );
}
