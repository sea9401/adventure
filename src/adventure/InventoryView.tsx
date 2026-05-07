"use client";

import { useState, type ReactNode } from "react";
import { Diamond, Flask, Sword } from "@phosphor-icons/react";
import { ITEMS, type ItemId } from "./data/items";
import { MATERIALS, type MaterialId } from "./data/materials";
import { POTIONS, POTION_IDS } from "./data/potions";
import type { InventoryState } from "./inventory/useInventory";

type InvTabKey = "equipment" | "materials" | "potions";

const TABS: { key: InvTabKey; label: string }[] = [
  { key: "equipment", label: "장비" },
  { key: "materials", label: "재료" },
  { key: "potions", label: "포션" },
];

export function InventoryView({
  inventory,
  onEquip,
}: {
  inventory: InventoryState;
  onEquip?: (id: ItemId) => void;
}) {
  const [tab, setTab] = useState<InvTabKey>("equipment");

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
      <nav
        role="tablist"
        aria-label="가방 탭"
        className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800"
      >
        {TABS.map((t) => {
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

      {tab === "equipment" &&
        (ownedEquipment.length === 0 ? (
          <EmptyTab
            icon={<Sword size={40} weight="duotone" />}
            title="보유한 장비가 없습니다"
            message="제작·의뢰·드랍으로 장비를 모아 보세요."
          />
        ) : (
          <section className="space-y-2">
            {ownedEquipment.map(({ id, item, count }) => (
              <div
                key={id}
                className="rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.name}
                    {count > 1 && (
                      <span className="ml-1 text-xs font-normal tabular-nums text-zinc-500 dark:text-zinc-400">
                        ×{count}
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
                {onEquip && (
                  <button
                    type="button"
                    onClick={() => onEquip(id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    장착
                  </button>
                )}
              </div>
            ))}
          </section>
        ))}

      {tab === "materials" &&
        (ownedMaterials.length === 0 ? (
          <EmptyTab
            icon={<Diamond size={40} weight="duotone" />}
            title="보유한 재료가 없습니다"
            message="상점에서 사거나 모험 중에 모을 수 있습니다."
          />
        ) : (
          <section className="space-y-2">
            {ownedMaterials.map(({ id, material, count }) => (
              <div
                key={id}
                className="rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90"
              >
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
              </div>
            ))}
          </section>
        ))}

      {tab === "potions" &&
        (ownedPotions.length === 0 ? (
          <EmptyTab
            icon={<Flask size={40} weight="duotone" />}
            title="보유한 포션이 없습니다"
            message="상점에서 구매할 수 있습니다."
          />
        ) : (
          <section className="space-y-2">
            {ownedPotions.map(({ id, potion, count }) => (
              <div
                key={id}
                className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/90"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {potion.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      ×{count}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {potion.description}
                  </p>
                </div>
              </div>
            ))}
          </section>
        ))}
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
