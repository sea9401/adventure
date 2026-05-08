"use client";

import { useState } from "react";
import { Diamond, Flask, Sword } from "@phosphor-icons/react";
import {
  ITEMS,
  findItemId,
  type EquipBonus,
  type EquipItem,
  type EquipSlot,
  type ItemId,
} from "./data/items";
import { MATERIALS, type MaterialId } from "./data/materials";
import { POTIONS, POTION_IDS, POTION_MAX_PER_TYPE } from "./data/potions";
import type { InventoryState } from "./inventory/useInventory";
import type { EquippedSlots } from "./character/types";
import { EquippedGrid } from "./character/CharacterMini";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";

type InvTabKey = "equipment" | "materials" | "potions";

const TABS: { key: InvTabKey; label: string }[] = [
  { key: "equipment", label: "장비" },
  { key: "materials", label: "재료" },
  { key: "potions", label: "포션" },
];

const SLOT_TABS: { key: EquipSlot; label: string }[] = [
  { key: "weapon", label: "무기" },
  { key: "armor", label: "방어구" },
  { key: "accessory", label: "장신구" },
];

const BONUS_LABELS: Record<keyof EquipBonus, string> = {
  atk: "공격력",
  def: "방어력",
  str: "힘",
  dex: "민첩",
  vit: "활력",
  spd: "속도",
  luk: "행운",
};

const BONUS_KEYS = Object.keys(BONUS_LABELS) as (keyof EquipBonus)[];

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
}: {
  inventory: InventoryState;
  equipped?: EquippedSlots;
  onEquip?: (id: ItemId) => void;
  onUnequip?: (slot: EquipSlot) => void;
}) {
  const [tab, setTab] = useState<InvTabKey>("equipment");
  const [equipSlotTab, setEquipSlotTab] = useState<EquipSlot>("weapon");

  const ownedEquipment = (Object.keys(ITEMS) as ItemId[])
    .map((id) => ({ id, item: ITEMS[id], count: inventory.equipment[id] ?? 0 }))
    .filter((e) => e.count > 0);
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

  return (
    <div className="space-y-3">
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={setTab}
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
              onChange={setEquipSlotTab}
              ariaLabel="장비 슬롯 탭"
              size="sm"
            />
            {ownedEquipment.filter((e) => e.item.slot === equipSlotTab)
              .length === 0 && (
              <p className="px-1 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                해당 종류의 장비가 없습니다.
              </p>
            )}
            {ownedEquipment
              .filter((e) => e.item.slot === equipSlotTab)
              .map(({ id, item, count }) => {
              const current = equipped?.[item.slot] ?? null;
              const isEquipped = findItemId(current) === id;
              const diff = isEquipped ? [] : computeDiff(item, current);
              return (
                <Card key={id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.name}
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
                      {item.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}
                    </span>
                  </div>
                  {item.description && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {item.description}
                    </p>
                  )}
                  {!isEquipped && diff.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        장착 시
                      </span>
                      {diff.map((d) => (
                        <span
                          key={d.key}
                          className={
                            d.delta > 0
                              ? "tabular-nums text-emerald-600 dark:text-emerald-400"
                              : "tabular-nums text-rose-600 dark:text-rose-400"
                          }
                        >
                          {d.label} {d.delta > 0 ? "+" : ""}
                          {d.delta}
                        </span>
                      ))}
                    </div>
                  )}
                  {onEquip && (
                    <button
                      type="button"
                      onClick={() => onEquip(id)}
                      disabled={isEquipped}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {isEquipped ? "장착중" : "장착"}
                    </button>
                  )}
                </Card>
              );
            })}
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
            {ownedMaterials.map(({ id, material, count }) => (
              <Card key={id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {material.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    ×{count}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {material.description}
                </p>
              </Card>
            ))}
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
            {ownedPotions.map(({ id, potion, count }) => (
              <Card key={id} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {potion.name}
                    </span>
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        count >= POTION_MAX_PER_TYPE
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {count} / {POTION_MAX_PER_TYPE}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {potion.description}
                  </p>
                </div>
              </Card>
            ))}
          </section>
        ))}
    </div>
  );
}

