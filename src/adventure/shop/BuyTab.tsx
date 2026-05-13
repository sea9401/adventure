"use client";

import { useState } from "react";
import { Coins } from "@phosphor-icons/react";
import { POTIONS, POTION_IDS, potionMax, type PotionId } from "../data/potions";
import { MATERIALS, type MaterialId } from "../data/materials";
import {
  CONSUMABLES,
  CONSUMABLE_IDS,
  type ConsumableId,
} from "../data/consumables";
import { ITEMS, type ItemId } from "../data/items";
import type { InventoryState } from "../inventory/useInventory";

// 상점에서 살 수 있는 장비 — EquipItem.shopPrice 가 지정된 것 (현재 초반 발판용 싸구려 한두 종).
const SHOP_EQUIPMENT_IDS = (Object.keys(ITEMS) as ItemId[]).filter(
  (id) => typeof (ITEMS[id] as { shopPrice?: number }).shopPrice === "number",
);
import { Card } from "@/components/ui/Card";
import { QtyStepper } from "./QtyStepper";

export function BuyTab({
  gold,
  inventory,
  isMaterialBuyable,
  onPurchasePotion,
  onPurchaseMaterial,
  onPurchaseConsumable,
  onPurchaseEquipment,
}: {
  gold: number;
  inventory: InventoryState;
  isMaterialBuyable: (id: MaterialId) => boolean;
  onPurchasePotion: (id: PotionId, quantity: number) => void;
  onPurchaseMaterial: (id: MaterialId, quantity: number) => void;
  onPurchaseConsumable: (id: ConsumableId, quantity: number) => void;
  onPurchaseEquipment: (id: ItemId, quantity: number) => void;
}) {
  // 구매 가능 재료 = 항상 취급(`inShop`) 또는 누적 100개 이상 판매로 잠금 해제된 것.
  const materialIds = (Object.keys(MATERIALS) as MaterialId[]).filter(
    (id) => MATERIALS[id].inShop || isMaterialBuyable(id),
  );
  const cap = potionMax(inventory.potionCapacityBonus ?? 0);
  // 카테고리 순서: 장비 → 재료 → 소모품. 포션은 소모품 카테고리 상단에 함께 표시
  // (보유 한도 cap 이 있어 BuyRow 에 cap 만 추가로 전달).
  const potionIds = POTION_IDS.filter((id) => POTIONS[id].inShop !== false);
  return (
    <div className="space-y-3">
      {SHOP_EQUIPMENT_IDS.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            장비
          </div>
          <div className="space-y-2">
            {SHOP_EQUIPMENT_IDS.map((id) => {
              const item = ITEMS[id];
              const price = (item as { shopPrice: number }).shopPrice;
              const statSummary = item.stats
                .map((s) => `${s.label} ${s.value}`)
                .join(", ");
              const owned = inventory.equipment[id] ?? 0;
              return (
                <BuyRow
                  key={id}
                  name={item.name}
                  description={`${statSummary}${
                    item.description ? ` — ${item.description}` : ""
                  }`}
                  price={price}
                  owned={owned}
                  gold={gold}
                  onPurchase={(qty) => onPurchaseEquipment(id, qty)}
                />
              );
            })}
          </div>
        </div>
      )}

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
                <BuyRow
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

      {(potionIds.length > 0 || CONSUMABLE_IDS.length > 0) && (
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            소모품
          </div>
          <div className="space-y-2">
            {potionIds.map((id) => {
              const potion = POTIONS[id];
              const owned = inventory.potions[id] ?? 0;
              return (
                <BuyRow
                  key={id}
                  name={potion.name}
                  description={potion.description}
                  price={potion.price}
                  owned={owned}
                  gold={gold}
                  cap={cap}
                  onPurchase={(qty) => onPurchasePotion(id, qty)}
                />
              );
            })}
            {CONSUMABLE_IDS.map((id) => {
              const c = CONSUMABLES[id];
              const owned = inventory.consumables[id] ?? 0;
              return (
                <BuyRow
                  key={id}
                  name={c.name}
                  description={c.description}
                  price={c.price}
                  owned={owned}
                  gold={gold}
                  onPurchase={(qty) => onPurchaseConsumable(id, qty)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BuyRow({
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
          <span className="tabular-nums">{price.toLocaleString()}</span>
          <span>/ 개</span>
        </div>
        <div className="ml-auto inline-flex items-center gap-1">
          <QtyStepper
            qty={qty}
            setQty={setQty}
            min={1}
            max={cap !== undefined ? room || 1 : undefined}
            disabled={isFull}
          />
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
                {totalCost.toLocaleString()}
              </span>
            )}
          </button>
        </div>
      </div>
    </Card>
  );
}
