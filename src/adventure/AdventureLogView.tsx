"use client";

import { useState, type ReactNode } from "react";
import {
  Compass,
  Diamond,
  MapPin,
  Sword,
  User,
} from "@phosphor-icons/react";
import { MONSTERS } from "./data/monsters";
import { NPCS, type NpcRole } from "./data/npcs";
import { WORLD_MAP } from "./data/world";
import type { AdventureLog } from "./log/storage";
import { getRevealStage, type MonsterRevealStage } from "./log/thresholds";
import { NpcAvatar } from "./NpcAvatar";

type LogTabKey = "monsters" | "items" | "npcs" | "towns" | "places";

const LOG_TABS: { key: LogTabKey; label: string }[] = [
  { key: "monsters", label: "몬스터" },
  { key: "items", label: "아이템" },
  { key: "npcs", label: "NPC" },
  { key: "towns", label: "마을" },
  { key: "places", label: "장소" },
];

const ROLE_LABEL: Record<NpcRole, string> = {
  elder: "촌장",
  vendor: "상인",
  innkeeper: "여관 주인",
  quest: "의뢰인",
  lore: "마을 사람",
  stranger: "방문자",
  trainer: "교관",
};

export function AdventureLogView({ log }: { log: AdventureLog }) {
  const [tab, setTab] = useState<LogTabKey>("monsters");

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

      {tab === "monsters" && <MonstersTab log={log} />}
      {tab === "items" && (
        <EmptyTab
          icon={<Diamond size={40} weight="duotone" />}
          title="아직 기록된 아이템이 없습니다"
          message="획득·장착한 아이템이 여기에 모입니다."
        />
      )}
      {tab === "npcs" && <NpcsTab log={log} />}
      {tab === "towns" && <TownsTab log={log} />}
      {tab === "places" && <PlacesTab log={log} />}
    </div>
  );
}

function EmptyTab({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <section className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/90">
      <div className="mx-auto inline-flex text-zinc-400 dark:text-zinc-500">
        {icon}
      </div>
      <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </div>
      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {message}
      </div>
    </section>
  );
}

function MonstersTab({ log }: { log: AdventureLog }) {
  const entries = Object.entries(log.monsters).filter(
    ([, e]) => e.encountered,
  );
  if (entries.length === 0) {
    return (
      <EmptyTab
        icon={<Sword size={40} weight="duotone" />}
        title="아직 기록된 몬스터가 없습니다"
        message="전투에서 적을 처음 만나면 도감에 등록됩니다."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {entries
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([name, entry]) => (
          <MonsterLogCard key={name} name={name} kills={entry.kills} />
        ))}
    </div>
  );
}

function MonsterLogCard({ name, kills }: { name: string; kills: number }) {
  const monster = MONSTERS[name];
  const stage = getRevealStage(kills);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="flex items-center gap-3">
        <MonsterAvatar name={name} stage={stage} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              처치 {kills}
            </span>
          </div>
          {monster && (
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <Stat label="HP" value={monster.hp} unlocked={stage >= 2} />
              <Stat label="EXP" value={monster.exp} unlocked={stage >= 4} />
              <Stat label="ATK" value={monster.atk} unlocked={stage >= 3} />
              <Stat label="DEF" value={monster.def} unlocked={stage >= 3} />
              <Stat label="SPD" value={monster.spd} unlocked={stage >= 3} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unlocked,
}: {
  label: string;
  value: number;
  unlocked: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span
        className={`tabular-nums ${
          unlocked
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-300 dark:text-zinc-700"
        }`}
      >
        {unlocked ? value : "?"}
      </span>
    </div>
  );
}

function MonsterAvatar({
  name,
  stage,
}: {
  name: string;
  stage: MonsterRevealStage;
}) {
  const image = MONSTERS[name]?.image;
  const silhouette = stage === 1;
  if (!image) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-base text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
        ?
      </div>
    );
  }
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        className={`h-full w-full object-cover transition-all ${
          silhouette ? "opacity-30 brightness-0" : ""
        }`}
      />
    </div>
  );
}

function TownsTab({ log }: { log: AdventureLog }) {
  const towns = WORLD_MAP.regions.filter(
    (r) => r.tags?.includes("town") && log.towns[r.id]?.visited,
  );
  if (towns.length === 0) {
    return (
      <EmptyTab
        icon={<MapPin size={40} weight="duotone" />}
        title="아직 기록된 마을이 없습니다"
        message="마을을 방문하면 안내문이 추가됩니다."
      />
    );
  }
  return (
    <div className="space-y-2">
      {towns.map((r) => {
        const entry = log.towns[r.id]!;
        const totalNpcs = NPCS.filter((n) => n.region === r.id).length;
        const talked = entry.npcsTalkedTo.length;
        return (
          <div
            key={r.id}
            className="rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {r.name}
              </span>
              {r.recommendedLevel !== undefined && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  적정 Lv.{r.recommendedLevel}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {r.description}
            </p>
            {totalNpcs > 0 && (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                만난 사람 {talked} / {totalNpcs}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlacesTab({ log }: { log: AdventureLog }) {
  const places = WORLD_MAP.regions.filter(
    (r) => !r.tags?.includes("town") && log.towns[r.id]?.visited,
  );
  if (places.length === 0) {
    return (
      <EmptyTab
        icon={<Compass size={40} weight="duotone" />}
        title="아직 기록된 장소가 없습니다"
        message="새로운 곳을 방문하면 안내문이 추가됩니다."
      />
    );
  }
  return (
    <div className="space-y-2">
      {places.map((r) => {
        const totalEnemies = r.enemies.length;
        const encountered = r.enemies.filter(
          (e) => log.monsters[e]?.encountered,
        ).length;
        return (
          <div
            key={r.id}
            className="rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {r.name}
              </span>
              {r.recommendedLevel !== undefined && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  적정 Lv.{r.recommendedLevel}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {r.description}
            </p>
            {totalEnemies > 0 && (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                만난 몬스터 {encountered} / {totalEnemies}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NpcsTab({ log }: { log: AdventureLog }) {
  const talked = NPCS.filter((n) => (log.npcs[n.id]?.talkCount ?? 0) > 0);
  if (talked.length === 0) {
    return (
      <EmptyTab
        icon={<User size={40} weight="duotone" />}
        title="아직 기록된 NPC가 없습니다"
        message="마을 사람들과 이야기하면 인물 노트가 쌓입니다."
      />
    );
  }
  return (
    <div className="space-y-2">
      {talked.map((n) => {
        const entry = log.npcs[n.id]!;
        return (
          <div
            key={n.id}
            className="rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90"
          >
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
          </div>
        );
      })}
    </div>
  );
}
