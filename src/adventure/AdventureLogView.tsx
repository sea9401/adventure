"use client";

import { useState } from "react";
import {
  CaretDown,
  CaretRight,
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
import {
  ITEMS,
  findItemId,
  type EquipSlot,
  type ItemId,
} from "./data/items";
import { MONSTERS } from "./data/monsters";
import { NPCS, type NpcRole } from "./data/npcs";
import { getRecipeById } from "./data/recipes";
import type { EquippedSlots } from "./character/types";
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
  STAT_SKILL_INFO_THRESHOLD,
  type StatKey,
} from "./data/stats";
import { STAT_SKILL } from "./character/skills";
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
  { key: "etc", label: "스탯" },
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
  knownRecipes,
  shareableRecipes,
  ownedEquipment,
  equippedSlots,
}: {
  log: AdventureLog;
  stats: Record<StatKey, number>;
  equippedTitleId?: string | null;
  onEquipTitle?: (titleId: TitleId | null) => void;
  /** 카운터형 칭호의 현재 진행도 — 절반 도달 시 조건 미리보기. */
  titleCounters?: TitleCounterValues;
  /** 학습한 제작서 id 목록. 미지정 시 빈 목록으로 처리. */
  knownRecipes?: string[];
  /** 거래/우편 공유 가능한 제작서 id 목록. 학습 시 자동 부여, 공유 시 소비. */
  shareableRecipes?: string[];
  /** 보유 장비 — itemId → 보유 수량. 미지정 시 빈 목록으로 처리. */
  ownedEquipment?: Partial<Record<ItemId, number>>;
  /** 현재 장착 중인 슬롯 — '장착중' 배지 표기용. */
  equippedSlots?: EquippedSlots;
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
        <ItemsTab
          knownRecipes={knownRecipes ?? []}
          shareableRecipes={shareableRecipes ?? []}
          ownedEquipment={ownedEquipment ?? {}}
          equippedSlots={equippedSlots}
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

// 모험의 서 → 아이템 탭. 보유 장비를 슬롯별 sub-tab 으로, 학습한 제작법을 마지막 sub-tab 으로.
// 인벤토리 액션 패널이 아니라 도감 — 장착 버튼 등은 없고 정보만.
type ItemSubTab = "weapon" | "armor" | "accessory" | "recipe";

const ITEM_SUB_TABS: { key: ItemSubTab; label: string }[] = [
  { key: "weapon", label: "무기" },
  { key: "armor", label: "방어구" },
  { key: "accessory", label: "장신구" },
  { key: "recipe", label: "제작법" },
];

const SLOT_EMOJI: Record<EquipSlot, string> = {
  weapon: "⚔️",
  armor: "🛡️",
  accessory: "💍",
};

function ItemsTab({
  knownRecipes,
  shareableRecipes,
  ownedEquipment,
  equippedSlots,
}: {
  knownRecipes: string[];
  shareableRecipes: string[];
  ownedEquipment: Partial<Record<ItemId, number>>;
  equippedSlots: EquippedSlots | undefined;
}) {
  const [sub, setSub] = useState<ItemSubTab>("weapon");

  return (
    <div className="space-y-3">
      <TabBar
        tabs={ITEM_SUB_TABS}
        active={sub}
        onChange={setSub}
        ariaLabel="아이템 종류"
        size="sm"
      />
      {sub === "recipe" ? (
        <RecipesSubTab
          knownRecipes={knownRecipes}
          shareableRecipes={shareableRecipes}
        />
      ) : (
        <EquipmentSubTab
          slot={sub}
          ownedEquipment={ownedEquipment}
          equippedSlots={equippedSlots}
        />
      )}
    </div>
  );
}

function EquipmentSubTab({
  slot,
  ownedEquipment,
  equippedSlots,
}: {
  slot: EquipSlot;
  ownedEquipment: Partial<Record<ItemId, number>>;
  equippedSlots: EquippedSlots | undefined;
}) {
  const items = (Object.keys(ITEMS) as ItemId[])
    .map((id) => ({ id, def: ITEMS[id], count: ownedEquipment[id] ?? 0 }))
    .filter((e) => e.count > 0 && e.def.slot === slot)
    .sort((a, b) => a.def.name.localeCompare(b.def.name));

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Diamond size={40} weight="duotone" />}
        title="보유한 장비가 없습니다"
        message="제작·드랍·보상 등으로 얻으면 여기에 모입니다."
      />
    );
  }

  const equippedId = findItemId(equippedSlots?.[slot] ?? null);

  return (
    <div className="space-y-2">
      {items.map(({ id, def, count }) => {
        const isEquipped = equippedId === id;
        return (
          <Card key={id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {SLOT_EMOJI[def.slot]} {def.name}
                {count > 1 && (
                  <span className="ml-1 text-xs font-normal tabular-nums text-zinc-500 dark:text-zinc-400">
                    ×{count}
                  </span>
                )}
                {isEquipped && (
                  <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-normal text-emerald-700 dark:text-emerald-400">
                    장착중
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                {def.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}
              </span>
            </div>
            {def.description && (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {def.description}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// 보유 제작법 — 학습한 제작서를 카드로. 거래 토큰 보유/소진 상태 같이 표기.
// 토큰 = 1 (거래 가능) / 0 (이미 공유에 사용 — 다시 습득해야 충전).
// 거래/우편 출처 학습은 토큰을 부여하지 않으므로 거래 횟수에 자연 상한이 생긴다.
function RecipesSubTab({
  knownRecipes,
  shareableRecipes,
}: {
  knownRecipes: string[];
  shareableRecipes: string[];
}) {
  const recipes = knownRecipes
    .map((id) => ({ id, def: getRecipeById(id) }))
    .filter((r): r is { id: string; def: NonNullable<typeof r.def> } => !!r.def)
    .sort((a, b) => a.def.name.localeCompare(b.def.name));

  if (recipes.length === 0) {
    return (
      <EmptyState
        icon={<Diamond size={40} weight="duotone" />}
        title="아직 학습한 제작서가 없습니다"
        message="NPC 보상이나 몬스터 드랍으로 제작서를 얻으면 여기에 표시됩니다."
      />
    );
  }

  return (
    <div className="space-y-2">
      {recipes.map(({ id, def }) => {
        const canShare = shareableRecipes.includes(id);
        return (
          <Card key={id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                📜 {def.name}
              </span>
              <span
                className={
                  canShare
                    ? "shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-normal text-emerald-700 dark:text-emerald-400"
                    : "shrink-0 rounded-full bg-zinc-500/10 px-2 py-0.5 text-[11px] font-normal text-zinc-500 dark:text-zinc-400"
                }
                title={
                  canShare
                    ? "거래소 등록 또는 우편 첨부 가능"
                    : "이미 공유에 사용 — 다시 습득하면 충전됩니다"
                }
              >
                거래 {canShare ? 1 : 0}/1
              </span>
            </div>
            {def.description ? (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {def.description}
              </p>
            ) : null}
          </Card>
        );
      })}
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
  const [lockedOpen, setLockedOpen] = useState(false);
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
  const obtained = all.filter((t) => !!log.titles[t.id]);
  const locked = all.filter((t) => !log.titles[t.id]);

  const renderCard = (title: (typeof all)[number]) => {
    const entry = log.titles[title.id];
    const isObtained = !!entry;
    const isEquipped = equippedTitleId === title.id;
    // 카운터형 칭호: 미획득 상태에서도 절반 도달 시 조건만 미리 공개.
    const counter = COUNTER_TITLES.find((c) => c.id === title.id);
    const counterValue = counter ? (titleCounters[counter.key] ?? 0) : 0;
    const conditionRevealed =
      !isObtained && !!counter && counterValue >= counter.target / 2;
    return (
      <Card key={title.id}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-baseline gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isObtained ? (
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
          {isObtained && entry && (
            <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {new Date(entry.obtainedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {isObtained ? (
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
        {isObtained && onEquipTitle && (
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
  };

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          획득한 칭호 ({obtained.length})
        </h3>
        {obtained.length === 0 ? (
          <p className="text-xs italic text-zinc-400 dark:text-zinc-500">
            아직 획득한 칭호가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">{obtained.map(renderCard)}</div>
        )}
      </section>

      {locked.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setLockedOpen((v) => !v)}
            aria-expanded={lockedOpen}
            className="mb-2 flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {lockedOpen ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
            미획득 칭호 ({locked.length})
          </button>
          {lockedOpen && (
            <div className="space-y-2">{locked.map(renderCard)}</div>
          )}
        </section>
      )}
    </div>
  );
}

function EtcTab({ stats }: { stats: Record<StatKey, number> }) {
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {STAT_KEYS.map((k) => {
          const value = stats[k];
          const tiers = STAT_SKILL[k];
          const tier1 = tiers[0];
          const tier2 = tiers[1];
          const tier1Revealed = value >= STAT_SKILL_INFO_THRESHOLD;
          const conversionRevealed = value >= STAT_REVEAL_THRESHOLD;
          // 1차 티어 발동 임계가 정보 공개 임계보다 높을 때 발동 안내.
          const showTier1ActivationNote =
            !!tier1 &&
            tier1Revealed &&
            tier1.activationThreshold > STAT_SKILL_INFO_THRESHOLD;
          // 2차 티어는 환산 공개와 동시 (15) 에 노출.
          const tier2Revealed = !!tier2 && conversionRevealed;
          // 2차 티어 발동 안내 — 정보 공개 (15) 와 발동 임계 (20/30) 차이가 있어 항상 표시.
          const showTier2ActivationNote =
            !!tier2 &&
            tier2Revealed &&
            tier2.activationThreshold > STAT_REVEAL_THRESHOLD;
          // 다음 공개 — tier1 → 환산+tier2.
          const nextRevealAt = tier1Revealed
            ? conversionRevealed
              ? "—"
              : STAT_REVEAL_THRESHOLD
            : STAT_SKILL_INFO_THRESHOLD;
          return (
            <Card as="li" key={k}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {STAT_LABELS[k]}
                </span>
                <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  현재 {value} / 다음 공개 {nextRevealAt}
                </span>
              </div>

              {/* 1차 스킬 — STAT_SKILL_INFO_THRESHOLD(5) 도달 시 공개. */}
              {tier1 && (
                <div className="mt-2 flex items-start gap-2 text-xs">
                  {tier1Revealed ? (
                    <>
                      <Sparkle
                        size={14}
                        weight="duotone"
                        className="shrink-0 text-amber-500 mt-0.5"
                      />
                      <span className="text-zinc-700 dark:text-zinc-200">
                        <span className="font-medium">{tier1.name}</span> —{" "}
                        {tier1.description}
                        {showTier1ActivationNote && (
                          <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                            ({STAT_LABELS[k]} {tier1.activationThreshold}에서
                            발동)
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock
                        size={14}
                        weight="duotone"
                        className="shrink-0 text-zinc-400 dark:text-zinc-500 mt-0.5"
                      />
                      <span className="italic text-zinc-500 dark:text-zinc-400">
                        {STAT_SKILL_INFO_THRESHOLD} 달성 시 스킬 정보 공개
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* 환산 효과 + 2차 스킬 — STAT_REVEAL_THRESHOLD(15) 도달 시 공개. */}
              <div className="mt-1.5 flex items-start gap-2 text-xs">
                {conversionRevealed ? (
                  <>
                    <Sparkle
                      size={14}
                      weight="duotone"
                      className="shrink-0 text-amber-500 mt-0.5"
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
                      className="shrink-0 text-zinc-400 dark:text-zinc-500 mt-0.5"
                    />
                    <span className="italic text-zinc-500 dark:text-zinc-400">
                      {STAT_REVEAL_THRESHOLD} 달성 시 효과 정보 공개
                    </span>
                  </>
                )}
              </div>

              {/* 2차 스킬 — 환산과 같은 타이밍에 공개. */}
              {tier2 && tier2Revealed && (
                <div className="mt-1.5 flex items-start gap-2 text-xs">
                  <Sparkle
                    size={14}
                    weight="duotone"
                    className="shrink-0 text-amber-500 mt-0.5"
                  />
                  <span className="text-zinc-700 dark:text-zinc-200">
                    <span className="font-medium">{tier2.name}</span> —{" "}
                    {tier2.description}
                    {showTier2ActivationNote && (
                      <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                        ({STAT_LABELS[k]} {tier2.activationThreshold}에서 발동)
                      </span>
                    )}
                  </span>
                </div>
              )}
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
  // 대화한 NPC 가 한 명이라도 있는 마을만 하위 탭으로 노출.
  const townTabs = WORLD_MAP.regions
    .filter((r) => r.tags?.includes("town"))
    .filter((r) => talked.some((n) => n.region === r.id))
    .map((r) => ({ key: r.id, label: r.name }));
  const [regionTab, setRegionTab] = useState<string>(
    () => townTabs[0]?.key ?? "",
  );

  if (talked.length === 0) {
    return (
      <EmptyState
        icon={<User size={40} weight="duotone" />}
        title="아직 기록된 NPC가 없습니다"
        message="마을 사람들과 이야기하면 인물 노트가 쌓입니다."
      />
    );
  }

  // 새 마을이 추가됐는데 이전 선택이 무효화된 경우 첫 탭으로 폴백 (state 는 안 건드림).
  const activeTab = townTabs.some((t) => t.key === regionTab)
    ? regionTab
    : (townTabs[0]?.key ?? "");
  const inTown = talked.filter((n) => n.region === activeTab);

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
        {inTown.map((n) => {
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
    </div>
  );
}
