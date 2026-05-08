"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminProvider, useAdmin } from "./AdminContext";
import { OverviewTab } from "./tabs/OverviewTab";
import { CharacterTab } from "./tabs/CharacterTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { QuestsTab } from "./tabs/QuestsTab";
import { CraftingTab } from "./tabs/CraftingTab";
import { LogTab } from "./tabs/LogTab";
import { MapTab } from "./tabs/MapTab";
import { NotificationsTab } from "./tabs/NotificationsTab";
import { AutoPotionTab } from "./tabs/AutoPotionTab";
import { DataTab } from "./tabs/DataTab";
import { UsersTab } from "./tabs/UsersTab";
import { MarketplaceTab } from "./tabs/MarketplaceTab";

type TabKey =
  | "overview"
  | "users"
  | "marketplace"
  | "character"
  | "inventory"
  | "quests"
  | "crafting"
  | "log"
  | "map"
  | "notifications"
  | "auto-potion"
  | "data";

const TABS: { key: TabKey; label: string; group: "system" | "edit" | "data" }[] = [
  { key: "overview", label: "개요", group: "system" },
  { key: "users", label: "유저", group: "system" },
  { key: "marketplace", label: "거래소", group: "system" },
  { key: "character", label: "캐릭터", group: "edit" },
  { key: "inventory", label: "인벤토리", group: "edit" },
  { key: "quests", label: "퀘스트", group: "edit" },
  { key: "crafting", label: "제작", group: "edit" },
  { key: "log", label: "모험의 서", group: "edit" },
  { key: "map", label: "지도", group: "edit" },
  { key: "notifications", label: "알림", group: "edit" },
  { key: "auto-potion", label: "자동포션", group: "edit" },
  { key: "data", label: "데이터", group: "data" },
];

function ShellInner() {
  const [tab, setTab] = useState<TabKey>("overview");
  const { readOnly, setReadOnly, toast } = useAdmin();

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
        <nav className="md:w-44 md:shrink-0">
          <ul className="flex flex-row flex-wrap gap-1 md:flex-col">
            {TABS.map((t) => (
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
        </nav>

        <main className="flex-1 space-y-4">
          {tab === "overview" && <OverviewTab />}
          {tab === "users" && <UsersTab />}
          {tab === "marketplace" && <MarketplaceTab />}
          {tab === "character" && <CharacterTab />}
          {tab === "inventory" && <InventoryTab />}
          {tab === "quests" && <QuestsTab />}
          {tab === "crafting" && <CraftingTab />}
          {tab === "log" && <LogTab />}
          {tab === "map" && <MapTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "auto-potion" && <AutoPotionTab />}
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
