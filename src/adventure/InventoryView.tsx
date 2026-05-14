"use client";

import { useEffect, useState } from "react";
import { Diamond, Flask, Scroll, Sword, Trash } from "@phosphor-icons/react";
import {
  BONUS_KEYS,
  BONUS_LABELS,
  findItemId,
  rarityTextClass,
  type EquipBonus,
  type EquipItem,
  type EquipSlot,
  type ItemId,
} from "./data/items";
import {
  craftTierSuffix,
  craftTierTextClass,
  type CraftTier,
} from "./data/craftQuality";
import {
  dropQualityPrefix,
  dropQualityTextClass,
  type DropQuality,
} from "./data/dropQuality";
import {
  buildEquipEntries,
  type EquipEntry,
} from "./inventory/equipEntries";
import { MATERIALS, type MaterialId } from "./data/materials";
import { POTIONS, POTION_IDS, potionMax } from "./data/potions";
import { CONSUMABLES, CONSUMABLE_IDS } from "./data/consumables";
import type { InventoryState } from "./inventory/useInventory";
import type { EquippedItem, EquippedSlots } from "./character/types";
import { EquippedGrid } from "./character/CharacterMini";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import {
  getItemTier,
  groupByTier,
  matchesEquipQuery,
  useTierToggle,
} from "@/adventure/equipment/tier";
import { EquipmentSearchInput } from "@/adventure/equipment/EquipmentSearchInput";
import { TierSectionHeader } from "@/adventure/equipment/TierSectionHeader";

type InvTabKey = "equipment" | "materials" | "potions" | "consumables";

const TABS: { key: InvTabKey; label: string }[] = [
  { key: "equipment", label: "장비" },
  { key: "materials", label: "재료" },
  { key: "potions", label: "포션" },
  { key: "consumables", label: "소모품" },
];

const SLOT_TABS: { key: EquipSlot; label: string }[] = [
  { key: "weapon", label: "무기" },
  { key: "armor", label: "방어구" },
  { key: "accessory", label: "장신구" },
];

// 가방 목록 한 줄의 공통 외형 — 카드 대신 얇은 행으로 압축.
const ROW =
  "rounded-md border border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50";

// 같은 슬롯에 장착 중인 게 이 entry 와 동종(id + 제작 등급 + 드랍 등급 일치)인지 — 동종 여분이면 표시상 "장착중".
function isEntryEquipped(
  entry: EquipEntry,
  current: EquippedItem | null | undefined,
): boolean {
  if (findItemId(current ?? null) !== entry.id) return false;
  if ((current?.craftTier ?? 0) !== (entry.tier ?? 0)) return false;
  return (current?.dropQuality ?? 0) === (entry.quality ?? 0);
}

function computeDiff(
  next: EquipItem,
  current: EquipItem | null | undefined,
): { key: keyof EquipBonus; label: string; delta: number }[] {
  const cur = current?.bonus ?? {};
  const nxt = next.bonus ?? {};
  return BONUS_KEYS.flatMap((k) => {
    const delta = (nxt[k] ?? 0) - (cur[k] ?? 0);
    if (delta === 0) return [];
    return [{ key: k, label: BONUS_LABELS[k], delta }];
  });
}

export function InventoryView({
  inventory,
  equipped,
  onEquip,
  onUnequip,
  onDiscard,
}: {
  inventory: InventoryState;
  equipped?: EquippedSlots;
  onEquip?: (id: ItemId, tier?: CraftTier, quality?: DropQuality) => void;
  onUnequip?: (slot: EquipSlot) => void;
  /** 장비 1개 폐기 — 보상 없음(2단계 확인). 미지정이면 폐기 버튼 숨김. */
  onDiscard?: (id: ItemId, tier?: CraftTier, quality?: DropQuality) => void;
}) {
  const [tab, setTab] = useState<InvTabKey>("equipment");
  const [equipSlotTab, setEquipSlotTab] = useState<EquipSlot>("weapon");
  const [equipQuery, setEquipQuery] = useState("");
  // 폐기 2단계 확인 — 현재 "정말 폐기?" 단계인 행의 key.
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const ownedEquipment = buildEquipEntries(inventory);
  const ownedMaterials = (Object.keys(MATERIALS) as MaterialId[])
    .map((id) => ({
      id,
      material: MATERIALS[id],
      count: inventory.materials[id] ?? 0,
    }))
    .filter((e) => e.count > 0);
  const ownedPotions = POTION_IDS.map((id) => ({
    id,
    potion: POTIONS[id],
    count: inventory.potions[id] ?? 0,
  })).filter((e) => e.count > 0);
  const ownedConsumables = CONSUMABLE_IDS.map((id) => ({
    id,
    consumable: CONSUMABLES[id],
    count: inventory.consumables[id] ?? 0,
  })).filter((e) => e.count > 0);
  const potionCap = potionMax(inventory.potionCapacityBonus ?? 0);

  // 슬롯 탭 + 이름 검색으로 필터, 진행 티어로 그룹화 — 페이저 대신 티어 헤더가 자연 분할.
  const filteredEquipment = ownedEquipment.filter(
    (e) =>
      e.item.slot === equipSlotTab && matchesEquipQuery(e.item, equipQuery),
  );
  // 동종 여분이 여러 개여도 "장착중" 표시는 딱 하나에만 — 첫 매칭 entry 의 key.
  const equippedEntryKey =
    filteredEquipment.find((e) =>
      isEntryEquipped(e, equipped?.[e.item.slot] ?? null),
    )?.key ?? null;
  const groupedEquipment = groupByTier(filteredEquipment, (e) =>
    getItemTier(e.id),
  );
  // 티어 접기/펴기 — 기본 접힘. 검색 활성 시 강제 펼침.
  const {
    isExpanded: isTierExpanded,
    toggle: toggleTier,
    expand: expandTier,
  } = useTierToggle();
  const equipSearching = equipQuery.trim().length > 0;
  // 현 슬롯에 장착 중인 아이템의 tier — 슬롯 진입/장비 교체 시 그 섹션을 자동 펼침(이후 사용자가 접을 수 있음).
  const equippedTier = equipped?.[equipSlotTab]
    ? getItemTier(findItemId(equipped[equipSlotTab]) ?? null)
    : null;
  useEffect(() => {
    if (equippedTier !== null) expandTier(equippedTier);
  }, [equipSlotTab, equippedTier, expandTier]);
  const materialsPager = usePagination(ownedMaterials, 12);
  const potionsPager = usePagination(ownedPotions, 12);
  const consumablesPager = usePagination(ownedConsumables, 12);

  return (
    <div className="space-y-3">
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={(k) => {
          setTab(k);
          setConfirmKey(null);
        }}
        ariaLabel="가방 탭"
      />

      {tab === "equipment" && equipped && (
        <Card as="section" padding="none">
          <div className="space-y-3 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              장착중
            </h3>
            <EquippedGrid equipped={equipped} onUnequip={onUnequip} />
          </div>
        </Card>
      )}

      {tab === "equipment" &&
        (ownedEquipment.length === 0 ? (
          <EmptyState
            icon={<Sword size={40} weight="duotone" />}
            title="보유한 장비가 없습니다"
            message="제작·의뢰·드랍으로 장비를 모아 보세요."
          />
        ) : (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              보유 장비
            </h3>
            <TabBar
              tabs={SLOT_TABS}
              active={equipSlotTab}
              onChange={(k) => {
                setEquipSlotTab(k);
                setConfirmKey(null);
              }}
              ariaLabel="장비 슬롯 탭"
              size="sm"
            />
            <EquipmentSearchInput
              value={equipQuery}
              onChange={setEquipQuery}
            />
            {filteredEquipment.length === 0 ? (
              <p className="px-1 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                {equipQuery
                  ? `“${equipQuery}” — 일치하는 장비가 없습니다.`
                  : "해당 종류의 장비가 없습니다."}
              </p>
            ) : (
              groupedEquipment.map(({ tier, meta, entries }) => {
                const open = equipSearching || isTierExpanded(tier);
                return (
                <div key={tier} className="space-y-1.5">
                  <TierSectionHeader
                    meta={meta}
                    count={entries.length}
                    expanded={open}
                    onToggle={() => toggleTier(tier)}
                  />
                  {open && (
                  <ul className="space-y-1.5">
                    {entries.map((entry) => {
                      const { key, id, tier: craftTier, quality, item } = entry;
                      const current = equipped?.[item.slot] ?? null;
                      const isEquipped = key === equippedEntryKey;
                      const diff = isEquipped
                        ? []
                        : computeDiff(item, current);
                      const suffix = craftTierSuffix(craftTier);
                      const prefix = dropQualityPrefix(quality).trim();
                      const confirming = confirmKey === key;
                      return (
                        <li key={key} className={`flex items-start gap-2 ${ROW}`}>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-baseline gap-x-1.5">
                              {prefix && (
                                <span className={`text-xs ${dropQualityTextClass(quality)}`}>
                                  {prefix}
                                </span>
                              )}
                              <span
                                className={`text-sm font-medium ${
                                  quality ? dropQualityTextClass(quality) : rarityTextClass(item)
                                }`}
                              >
                                {item.name}
                              </span>
                              {suffix && (
                                <span className={`text-xs ${craftTierTextClass(craftTier)}`}>
                                  {suffix.trim()}
                                </span>
                              )}
                              {isEquipped && (
                                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                  장착중
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                {item.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}
                              </span>
                              {!isEquipped && diff.length > 0 && (
                                <span className="inline-flex flex-wrap items-baseline gap-x-1.5 text-[11px]">
                                  <span className="text-zinc-400 dark:text-zinc-500">장착 시</span>
                                  {diff.map((d) => (
                                    <span
                                      key={d.key}
                                      className={
                                        d.delta > 0
                                          ? "tabular-nums text-emerald-600 dark:text-emerald-400"
                                          : "tabular-nums text-rose-600 dark:text-rose-400"
                                      }
                                    >
                                      {d.label}
                                      {d.delta > 0 ? "+" : ""}
                                      {d.delta}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 pt-0.5">
                            {confirming ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDiscard?.(id, craftTier, quality);
                                    setConfirmKey(null);
                                  }}
                                  className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-rose-700"
                                >
                                  폐기
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmKey(null)}
                                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <>
                                {onEquip && (
                                  <button
                                    type="button"
                                    onClick={() => onEquip(id, craftTier, quality)}
                                    disabled={isEquipped}
                                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                  >
                                    {isEquipped ? "장착중" : "장착"}
                                  </button>
                                )}
                                {onDiscard && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmKey(key)}
                                    aria-label="폐기"
                                    title="폐기"
                                    className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                  >
                                    <Trash size={15} weight="bold" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  )}
                </div>
                );
              })
            )}
          </section>
        ))}

      {tab === "materials" &&
        (ownedMaterials.length === 0 ? (
          <EmptyState
            icon={<Diamond size={40} weight="duotone" />}
            title="보유한 재료가 없습니다"
            message="상점에서 사거나 모험 중에 모을 수 있습니다."
          />
        ) : (
          <section className="space-y-2">
            <ul className="space-y-1.5">
              {materialsPager.pageItems.map(({ id, material, count }) => (
                <li key={id} className={ROW}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {material.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      ×{count}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {material.description}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination
              page={materialsPager.page}
              pageCount={materialsPager.pageCount}
              setPage={materialsPager.setPage}
            />
          </section>
        ))}

      {tab === "potions" &&
        (ownedPotions.length === 0 ? (
          <EmptyState
            icon={<Flask size={40} weight="duotone" />}
            title="보유한 포션이 없습니다"
            message="상점에서 구매할 수 있습니다."
          />
        ) : (
          <section className="space-y-2">
            <ul className="space-y-1.5">
              {potionsPager.pageItems.map(({ id, potion, count }) => (
                <li key={id} className={ROW}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {potion.name}
                    </span>
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        count >= potionCap
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {count} / {potionCap}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {potion.description}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination
              page={potionsPager.page}
              pageCount={potionsPager.pageCount}
              setPage={potionsPager.setPage}
            />
          </section>
        ))}

      {tab === "consumables" &&
        (ownedConsumables.length === 0 ? (
          <EmptyState
            icon={<Scroll size={40} weight="duotone" />}
            title="보유한 소모품이 없습니다"
            message="상점에서 구매할 수 있습니다."
          />
        ) : (
          <section className="space-y-2">
            <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
              지도에서 가본 마을을 선택하면 자동으로 사용됩니다.
            </p>
            <ul className="space-y-1.5">
              {consumablesPager.pageItems.map(({ id, consumable, count }) => (
                <li key={id} className={ROW}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {consumable.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      ×{count}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {consumable.description}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination
              page={consumablesPager.page}
              pageCount={consumablesPager.pageCount}
              setPage={consumablesPager.setPage}
            />
          </section>
        ))}
    </div>
  );
}
