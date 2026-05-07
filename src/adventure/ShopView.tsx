"use client";

import { useState } from "react";
import { Coins } from "@phosphor-icons/react";
import {
  POTIONS,
  POTION_IDS,
  POTION_MAX_PER_TYPE,
  type PotionId,
} from "./data/potions";
import { MATERIALS, type MaterialId } from "./data/materials";
import type { InventoryState } from "./inventory/useInventory";
import { Card } from "@/components/ui/Card";

export function ShopView({
  gold,
  inventory,
  onPurchasePotion,
  onPurchaseMaterial,
}: {
  gold: number;
  inventory: InventoryState;
  onPurchasePotion: (id: PotionId, quantity: number) => void;
  onPurchaseMaterial: (id: MaterialId, quantity: number) => void;
}) {
  const materialIds = (Object.keys(MATERIALS) as MaterialId[]).filter(
    (id) => MATERIALS[id].inShop,
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
        <Coins size={16} weight="fill" className="text-yellow-500" />
        <span className="tabular-nums">{gold.toLocaleString()}</span>
      </div>

      <div>
        <div className="mb-1.5 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          물약
        </div>
        <div className="space-y-2">
          {POTION_IDS.map((id) => {
            const potion = POTIONS[id];
            const owned = inventory.potions[id] ?? 0;
            return (
              <ShopRow
                key={id}
                name={potion.name}
                description={potion.description}
                price={potion.price}
                owned={owned}
                gold={gold}
                cap={POTION_MAX_PER_TYPE}
                onPurchase={(qty) => onPurchasePotion(id, qty)}
              />
            );
          })}
        </div>
      </div>

      {materialIds.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            재료
          </div>
          <div className="space-y-2">
            {materialIds.map((id) => {
              const m = MATERIALS[id];
              const owned = inventory.materials[id] ?? 0;
              return (
                <ShopRow
                  key={id}
                  name={m.name}
                  description={m.description}
                  price={m.price}
                  owned={owned}
                  gold={gold}
                  onPurchase={(qty) => onPurchaseMaterial(id, qty)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ShopRow({
  name,
  description,
  price,
  owned,
  gold,
  cap,
  onPurchase,
}: {
  name: string;
  description: string;
  price: number;
  owned: number;
  gold: number;
  cap?: number;
  onPurchase: (quantity: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const room = cap !== undefined ? Math.max(0, cap - owned) : Infinity;
  const isFull = cap !== undefined && owned >= cap;
  const effectiveQty = Math.min(qty, room);
  const totalCost = price * effectiveQty;
  const canAfford = gold >= totalCost;
  const canPurchase = !isFull && effectiveQty > 0 && canAfford;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {name}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          보유 {owned}
          {cap !== undefined ? ` / ${cap}` : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <Coins size={12} weight="fill" className="text-yellow-500" />
          <span className="tabular-nums">{price}</span>
          <span>/ 개</span>
        </div>
        <div className="ml-auto inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1 || isFull}
            className="h-7 w-7 rounded-md border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="수량 감소"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={cap !== undefined ? room : undefined}
            value={qty}
            disabled={isFull}
            onChange={(e) => {
              const raw = Math.max(1, Math.floor(Number(e.target.value) || 1));
              setQty(cap !== undefined ? Math.min(raw, room || 1) : raw);
            }}
            className="w-12 rounded-md border border-zinc-300 bg-white px-2 py-1 text-center text-sm tabular-nums disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="button"
            onClick={() =>
              setQty((q) =>
                cap !== undefined ? Math.min(q + 1, room || 1) : q + 1,
              )
            }
            disabled={isFull || (cap !== undefined && qty >= room)}
            className="h-7 w-7 rounded-md border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="수량 증가"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              if (canPurchase) {
                onPurchase(effectiveQty);
                setQty(1);
              }
            }}
            disabled={!canPurchase}
            className="ml-1 inline-flex items-center gap-1 rounded-md border border-emerald-500 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-400 dark:text-emerald-300"
          >
            {isFull ? "가득 참" : "구매"}
            {!isFull && (
              <span className="inline-flex items-center gap-0.5 text-xs tabular-nums">
                <Coins size={10} weight="fill" className="text-yellow-500" />
                {totalCost}
              </span>
            )}
          </button>
        </div>
      </div>
    </Card>
  );
}
