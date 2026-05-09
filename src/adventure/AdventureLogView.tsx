"use client";

import { useState } from "react";
import {
  Compass,
  Crown,
  Diamond,
  Lock,
  MapPin,
  Sparkle,
  Sword,
  User,
} from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { MONSTERS } from "./data/monsters";
import { NPCS, type NpcRole } from "./data/npcs";
import {
  COUNTER_TITLES,
  TITLES,
  type TitleCounterKey,
  type TitleId,
} from "./data/titles";

export type TitleCounterValues = Partial<Record<TitleCounterKey, number>>;
import {
  STAT_CONVERSIONS,
  STAT_KEYS,
  STAT_LABELS,
  STAT_REVEAL_THRESHOLD,
  type StatKey,
} from "./data/stats";
import { WORLD_MAP } from "./data/world";
import type { AdventureLog } from "./log/storage";
import { getRevealStage, type MonsterRevealStage } from "./log/thresholds";
import { NpcAvatar } from "./NpcAvatar";

type LogTabKey =
  | "monsters"
  | "items"
  | "npcs"
  | "towns"
  | "places"
  | "etc"
  | "titles";

const LOG_TABS: { key: LogTabKey; label: string }[] = [
  { key: "monsters", label: "몬스터" },
  { key: "items", label: "아이템" },
  { key: "npcs", label: "NPC" },
  { key: "towns", label: "마을" },
  { key: "places", label: "장소" },
  { key: "etc", label: "기타" },
  { key: "titles", label: "칭호" },
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

export function AdventureLogView({
  log,
  stats,
  equippedTitleId,
  onEquipTitle,
  titleCounters,
}: {
  log: AdventureLog;
  stats: Record<StatKey, number>;
  equippedTitleId?: string | null;
  onEquipTitle?: (titleId: TitleId | null) => void;
  /** 카운터형 칭호의 현재 진행도 — 절반 도달 시 조건 미리보기. */
  titleCounters?: TitleCounterValues;
}) {
  const [tab, setTab] = useState<LogTabKey>("monsters");

  return (
    <div className="space-y-3">
      <TabBar
        tabs={LOG_TABS}
        active={tab}
        onChange={setTab}
        ariaLabel="모험의 서 탭"
        scrollable
      />

      {tab === "monsters" && <MonstersTab log={log} />}
      {tab === "items" && (
        <EmptyState
          icon={<Diamond size={40} weight="duotone" />}
          title="아직 기록된 아이템이 없습니다"
          message="획득·장착한 아이템이 여기에 모입니다."
        />
      )}
      {tab === "npcs" && <NpcsTab log={log} />}
      {tab === "towns" && <TownsTab log={log} />}
      {tab === "places" && <PlacesTab log={log} />}
      {tab === "etc" && <EtcTab stats={stats} />}
      {tab === "titles" && (
        <TitlesTab
          log={log}
          equippedTitleId={equippedTitleId ?? null}
          onEquipTitle={onEquipTitle}
          titleCounters={titleCounters ?? {}}
        />
      )}
    </div>
  );
}

// 도감에는 정의된 모든 칭호를 잠금/획득 상태로 표시 — 그 중 획득(log.titles 등록)된
// 칭호만 장착/해제 가능. 한 번에 한 개만 장착 (equippedTitleId).
function TitlesTab({
  log,
  equippedTitleId,
  onEquipTitle,
  titleCounters,
}: {
  log: AdventureLog;
  equippedTitleId: string | null;
  onEquipTitle?: (titleId: TitleId | null) => void;
  titleCounters: TitleCounterValues;
}) {
  const all = Object.values(TITLES);
  if (all.length === 0) {
    return (
      <EmptyState
        icon={<Crown size={40} weight="duotone" />}
        title="아직 정의된 칭호가 없습니다"
        message="추후 업데이트로 추가될 예정입니다."
      />
    );
  }
  return (
    <div className="space-y-2">
      {all.map((title) => {
        const entry = log.titles[title.id];
        const obtained = !!entry;
        const isEquipped = equippedTitleId === title.id;
        // 카운터형 칭호: 미획득 상태에서도 절반 도달 시 조건만 미리 공개.
        const counter = COUNTER_TITLES.find((c) => c.id === title.id);
        const counterValue = counter
          ? (titleCounters[counter.key] ?? 0)
          : 0;
        const conditionRevealed =
          !obtained && !!counter && counterValue >= counter.target / 2;
        return (
          <Card key={title.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-baseline gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {obtained ? (
                  title.name
                ) : (
                  <span className="flex items-center gap-1 italic text-zinc-400 dark:text-zinc-500">
                    <Lock size={12} weight="duotone" />
                    ???
                  </span>
                )}
                {isEquipped && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-normal text-emerald-700 dark:text-emerald-400">
                    장착중
                  </span>
                )}
              </span>
              {obtained && entry && (
                <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {new Date(entry.obtainedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {obtained ? (
                title.description
              ) : conditionRevealed ? (
                <span className="text-zinc-500 dark:text-zinc-400">
                  달성 조건 — {title.condition} ({counterValue}/{counter!.target})
                </span>
              ) : (
                <span className="italic text-zinc-400 dark:text-zinc-500">
                  달성 조건 ???
                </span>
              )}
            </p>
            {obtained && onEquipTitle && (
              <button
                type="button"
                onClick={() =>
                  onEquipTitle(isEquipped ? null : (title.id as TitleId))
                }
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {isEquipped ? "해제" : "장착"}
              </button>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function EtcTab({ stats }: { stats: Record<StatKey, number> }) {
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {STAT_KEYS.map((k) => {
          const value = stats[k];
          const revealed = value >= STAT_REVEAL_THRESHOLD;
          return (
            <Card as="li" key={k}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {STAT_LABELS[k]}
                </span>
                <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  현재 {value} / 공개 {STAT_REVEAL_THRESHOLD}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                {revealed ? (
                  <>
                    <Sparkle
                      size={14}
                      weight="duotone"
                      className="shrink-0 text-amber-500"
                    />
                    <span className="text-zinc-700 dark:text-zinc-200">
                      {STAT_CONVERSIONS[k]}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock
                      size={14}
                      weight="duotone"
                      className="shrink-0 text-zinc-400 dark:text-zinc-500"
                    />
                    <span className="italic text-zinc-500 dark:text-zinc-400">
                      {STAT_REVEAL_THRESHOLD} 달성 시 정보 공개
                    </span>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}

function MonstersTab({ log }: { log: AdventureLog }) {
  const entries = Object.entries(log.monsters).filter(
    ([, e]) => e.encountered,
  );
  if (entries.length === 0) {
    return (
      <EmptyState
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
    <Card>
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
    </Card>
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
        alt={silhouette ? "아직 발견되지 않은 몬스터" : name}
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
      <EmptyState
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
          <Card key={r.id}>
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
          </Card>
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
      <EmptyState
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
          <Card key={r.id}>
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
          </Card>
        );
      })}
    </div>
  );
}

function NpcsTab({ log }: { log: AdventureLog }) {
  const talked = NPCS.filter((n) => (log.npcs[n.id]?.talkCount ?? 0) > 0);
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
    <div className="space-y-2">
      {talked.map((n) => {
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
    </div>
  );
}
