"use client";

import { Backpack } from "@phosphor-icons/react";
import { ITEMS, type ItemId } from "./data/items";
import { POTIONS, POTION_IDS } from "./data/potions";
import type { InventoryState } from "./inventory/useInventory";

export function InventoryView({
  inventory,
  onEquip,
}: {
  inventory: InventoryState;
  onEquip?: (id: ItemId) => void;
}) {
  const owned = POTION_IDS.map((id) => ({
    id,
    potion: POTIONS[id],
    count: inventory.potions[id] ?? 0,
  }));
  const totalPotions = owned.reduce((sum, e) => sum + e.count, 0);
  const ownedEquipment = (Object.keys(ITEMS) as ItemId[])
    .map((id) => ({ id, item: ITEMS[id], count: inventory.equipment[id] ?? 0 }))
    .filter((e) => e.count > 0);
  const isEmpty = totalPotions === 0 && ownedEquipment.length === 0;

  return (
    <div className="space-y-3">
      {isEmpty ? (
        <section className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/90">
          <div className="mx-auto inline-flex text-zinc-400 dark:text-zinc-500">
            <Backpack size={40} weight="duotone" />
          </div>
          <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
            가방이 비어 있습니다
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            상점에서 물약을 사거나, 의뢰·제작으로 장비를 얻어 보세요.
          </div>
        </section>
      ) : (
        <>
          {ownedEquipment.length > 0 && (
            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                장비
              </div>
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
                      {item.stats
                        .map((s) => `${s.label} ${s.value}`)
                        .join(" · ")}
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
          )}

          {totalPotions > 0 && (
            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                물약
              </div>
              {owned
                .filter((e) => e.count > 0)
                .map(({ id, potion, count }) => (
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
          )}
        </>
      )}
    </div>
  );
}
