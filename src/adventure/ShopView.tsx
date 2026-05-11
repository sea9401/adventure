"use client";

import { useState } from "react";
import { Coins } from "@phosphor-icons/react";
import {
  POTIONS,
  POTION_IDS,
  potionMax,
  type PotionId,
} from "./data/potions";
import { MATERIALS, type MaterialId } from "./data/materials";
import { ITEMS, type ItemId } from "./data/items";
import { craftTierSuffix, type CraftTier } from "./data/craftQuality";
import {
  CONSUMABLES,
  CONSUMABLE_IDS,
  type ConsumableId,
} from "./data/consumables";
import {
  getItemSellPrice,
  getMaterialSellPrice,
  getPotionSellPrice,
} from "./data/sellPrices";
import type { InventoryState } from "./inventory/useInventory";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";

type ShopTabKey = "buy" | "sell";

const TABS: { key: ShopTabKey; label: string }[] = [
  { key: "buy", label: "구매" },
  { key: "sell", label: "판매" },
];

type SellCategoryKey = "equipment" | "materials" | "potions";

const SELL_TABS: { key: SellCategoryKey; label: string }[] = [
  { key: "equipment", label: "장비" },
  { key: "materials", label: "재료" },
  { key: "potions", label: "포션" },
];

export function ShopView({
  gold,
  inventory,
  isMaterialBuyable,
  onPurchasePotion,
  onPurchaseMaterial,
  onPurchaseConsumable,
  onSellPotion,
  onSellMaterial,
  onSellEquipment,
}: {
  gold: number;
  inventory: InventoryState;
  isMaterialBuyable: (id: MaterialId) => boolean;
  onPurchasePotion: (id: PotionId, quantity: number) => void;
  onPurchaseMaterial: (id: MaterialId, quantity: number) => void;
  onPurchaseConsumable: (id: ConsumableId, quantity: number) => void;
  onSellPotion: (id: PotionId, quantity: number) => void;
  onSellMaterial: (id: MaterialId, quantity: number) => void;
  onSellEquipment: (id: ItemId, quantity: number, craftTier?: CraftTier) => void;
}) {
  const [tab, setTab] = useState<ShopTabKey>("buy");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
        <Coins size={16} weight="fill" className="text-yellow-500" />
        <span className="tabular-nums">{gold.toLocaleString()}</span>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} ariaLabel="상점 탭" />

      {tab === "buy" && (
        <BuyTab
          gold={gold}
          inventory={inventory}
          isMaterialBuyable={isMaterialBuyable}
          onPurchasePotion={onPurchasePotion}
          onPurchaseMaterial={onPurchaseMaterial}
          onPurchaseConsumable={onPurchaseConsumable}
        />
      )}
      {tab === "sell" && (
        <SellTab
          inventory={inventory}
          onSellPotion={onSellPotion}
          onSellMaterial={onSellMaterial}
          onSellEquipment={onSellEquipment}
        />
      )}
    </div>
  );
}

function BuyTab({
  gold,
  inventory,
  isMaterialBuyable,
  onPurchasePotion,
  onPurchaseMaterial,
  onPurchaseConsumable,
}: {
  gold: number;
  inventory: InventoryState;
  isMaterialBuyable: (id: MaterialId) => boolean;
  onPurchasePotion: (id: PotionId, quantity: number) => void;
  onPurchaseMaterial: (id: MaterialId, quantity: number) => void;
  onPurchaseConsumable: (id: ConsumableId, quantity: number) => void;
}) {
  // 구매 가능 재료 = 항상 취급(`inShop`) 또는 누적 100개 이상 판매로 잠금 해제된 것.
  const materialIds = (Object.keys(MATERIALS) as MaterialId[]).filter(
    (id) => MATERIALS[id].inShop || isMaterialBuyable(id),
  );
  const cap = potionMax(inventory.potionCapacityBonus ?? 0);
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          물약
        </div>
        <div className="space-y-2">
          {POTION_IDS.map((id) => {
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

      <div>
        <div className="mb-1.5 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          소모품
        </div>
        <div className="space-y-2">
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

// 판매 가능한 장비 한 줄 — 무등급 스택(tier 없음)과 제작산 등급 스택(±1·±2).
type SellEquipEntry = { id: ItemId; tier?: CraftTier; count: number };

function buildSellEquipEntries(inventory: InventoryState): SellEquipEntry[] {
  const entries: SellEquipEntry[] = [];
  for (const id of Object.keys(ITEMS) as ItemId[]) {
    const n = inventory.equipment[id] ?? 0;
    if (n > 0) entries.push({ id, count: n });
  }
  for (const [id, tiers] of Object.entries(inventory.craftedEquipment)) {
    for (const [t, n] of Object.entries(tiers ?? {})) {
      if (n && n > 0) entries.push({ id: id as ItemId, tier: Number(t) as CraftTier, count: n });
    }
  }
  return entries;
}

function SellTab({
  inventory,
  onSellPotion,
  onSellMaterial,
  onSellEquipment,
}: {
  inventory: InventoryState;
  onSellPotion: (id: PotionId, quantity: number) => void;
  onSellMaterial: (id: MaterialId, quantity: number) => void;
  onSellEquipment: (id: ItemId, quantity: number, craftTier?: CraftTier) => void;
}) {
  const [category, setCategory] = useState<SellCategoryKey>("equipment");

  const ownedPotions = POTION_IDS.filter(
    (id) => (inventory.potions[id] ?? 0) > 0,
  );
  const ownedMaterials = (Object.keys(MATERIALS) as MaterialId[]).filter(
    (id) => (inventory.materials[id] ?? 0) > 0,
  );
  const equipEntries = buildSellEquipEntries(inventory);

  if (
    ownedPotions.length === 0 &&
    ownedMaterials.length === 0 &&
    equipEntries.length === 0
  ) {
    return (
      <EmptyState
        icon={<Coins size={40} weight="fill" />}
        title="판매할 아이템이 없습니다"
        message="가방에 들어 있는 항목만 팔 수 있어요."
      />
    );
  }

  return (
    <div className="space-y-3">
      <TabBar
        tabs={SELL_TABS}
        active={category}
        onChange={setCategory}
        ariaLabel="판매 카테고리"
      />

      {category === "equipment" &&
        (equipEntries.length > 0 ? (
          <SellRows
            rows={equipEntries.map(({ id, tier, count }) => ({
              key: tier ? `${id}@${tier}` : id,
              name: ITEMS[id].name + craftTierSuffix(tier),
              description: ITEMS[id].description ?? "",
              owned: count,
              unitPrice: getItemSellPrice(id),
              onSell: (qty) => onSellEquipment(id, qty, tier),
            }))}
          />
        ) : (
          <SellCategoryEmpty label="장비" />
        ))}

      {category === "materials" &&
        (ownedMaterials.length > 0 ? (
          <SellRows
            rows={ownedMaterials.map((id) => ({
              key: id,
              name: MATERIALS[id].name,
              description: MATERIALS[id].description,
              owned: inventory.materials[id] ?? 0,
              unitPrice: getMaterialSellPrice(id),
              onSell: (qty) => onSellMaterial(id, qty),
            }))}
          />
        ) : (
          <SellCategoryEmpty label="재료" />
        ))}

      {category === "potions" &&
        (ownedPotions.length > 0 ? (
          <SellRows
            rows={ownedPotions.map((id) => ({
              key: id,
              name: POTIONS[id].name,
              description: POTIONS[id].description,
              owned: inventory.potions[id] ?? 0,
              unitPrice: getPotionSellPrice(id),
              onSell: (qty) => onSellPotion(id, qty),
            }))}
          />
        ) : (
          <SellCategoryEmpty label="포션" />
        ))}
    </div>
  );
}

function SellRows({
  rows,
}: {
  rows: Array<{
    key: string;
    name: string;
    description: string;
    owned: number;
    unitPrice: number;
    onSell: (qty: number) => void;
  }>;
}) {
  const pager = usePagination(rows, 10);
  return (
    <div className="space-y-2">
      {pager.pageItems.map(({ key, ...rest }) => (
        <SellRow key={key} {...rest} />
      ))}
      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        setPage={pager.setPage}
      />
    </div>
  );
}

function SellCategoryEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white/60 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-400">
      판매할 {label}이(가) 없습니다.
    </div>
  );
}

function SellRow({
  name,
  description,
  owned,
  unitPrice,
  onSell,
}: {
  name: string;
  description: string;
  owned: number;
  unitPrice: number;
  onSell: (qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const max = Math.max(1, owned);
  const effectiveQty = Math.min(qty, owned);
  const total = unitPrice * effectiveQty;
  const canSell = effectiveQty > 0 && owned > 0;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {name}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          보유 {owned}
        </span>
      </div>
      {description && (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <div className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <Coins size={12} weight="fill" className="text-yellow-500" />
          <span className="tabular-nums">{unitPrice}</span>
          <span>/ 개</span>
        </div>
        <div className="ml-auto inline-flex items-center gap-1">
          <QtyStepper qty={qty} setQty={setQty} min={1} max={max} />
          <button
            type="button"
            onClick={() => {
              if (!canSell) return;
              onSell(effectiveQty);
              setQty(1);
            }}
            disabled={!canSell}
            className="ml-1 inline-flex items-center gap-1 rounded-md border border-rose-400 bg-rose-500/10 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400 dark:text-rose-300"
          >
            판매
            <span className="inline-flex items-center gap-0.5 text-xs tabular-nums">
              <Coins size={10} weight="fill" className="text-yellow-500" />
              {total}
            </span>
          </button>
        </div>
      </div>
    </Card>
  );
}

function QtyStepper({
  qty,
  setQty,
  min,
  max,
  disabled,
}: {
  qty: number;
  setQty: (n: number | ((prev: number) => number)) => void;
  min: number;
  max?: number;
  disabled?: boolean;
}) {
  const clamp = (n: number) => {
    let v = Math.max(min, Math.floor(n || min));
    if (max !== undefined) v = Math.min(v, max);
    return v;
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setQty((q) => clamp(q - 1))}
        disabled={disabled || qty <= min}
        className="h-7 w-7 rounded-md border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-label="수량 감소"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={qty}
        disabled={disabled}
        onChange={(e) => setQty(clamp(Number(e.target.value)))}
        className="w-12 rounded-md border border-zinc-300 bg-white px-2 py-1 text-center text-sm tabular-nums disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        type="button"
        onClick={() => setQty((q) => clamp(q + 1))}
        disabled={disabled || (max !== undefined && qty >= max)}
        className="h-7 w-7 rounded-md border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-label="수량 증가"
      >
        +
      </button>
    </>
  );
}
