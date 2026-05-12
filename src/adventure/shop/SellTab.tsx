"use client";

import { useState } from "react";
import { Coins } from "@phosphor-icons/react";
import { POTIONS, POTION_IDS, type PotionId } from "../data/potions";
import { MATERIALS, type MaterialId } from "../data/materials";
import { ITEMS, type ItemId } from "../data/items";
import { craftTierSuffix, type CraftTier } from "../data/craftQuality";
import { dropQualityPrefix, type DropQuality } from "../data/dropQuality";
import {
  getItemSellPrice,
  getMaterialSellPrice,
  getPotionSellPrice,
} from "../data/sellPrices";
import type { InventoryState } from "../inventory/useInventory";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { QtyStepper } from "./QtyStepper";

type SellCategoryKey = "equipment" | "materials" | "potions";

const SELL_TABS: { key: SellCategoryKey; label: string }[] = [
  { key: "equipment", label: "장비" },
  { key: "materials", label: "재료" },
  { key: "potions", label: "포션" },
];

// 판매 가능한 장비 한 줄 — 기본 스택(등급 없음) · 제작산 등급(±1·±2) · 드랍 고품질(1·2).
type SellEquipEntry = {
  id: ItemId;
  tier?: CraftTier;
  quality?: DropQuality;
  count: number;
};

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
  for (const [id, quals] of Object.entries(inventory.droppedEquipment)) {
    for (const [q, n] of Object.entries(quals ?? {})) {
      const quality = Number(q) as DropQuality;
      if (n && n > 0 && (quality === 1 || quality === 2)) {
        entries.push({ id: id as ItemId, quality, count: n });
      }
    }
  }
  return entries;
}

export function SellTab({
  inventory,
  onSellPotion,
  onSellMaterial,
  onSellEquipment,
}: {
  inventory: InventoryState;
  onSellPotion: (id: PotionId, quantity: number) => void;
  onSellMaterial: (id: MaterialId, quantity: number) => void;
  onSellEquipment: (
    id: ItemId,
    quantity: number,
    craftTier?: CraftTier,
    dropQuality?: DropQuality,
  ) => void;
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
            rows={equipEntries.map(({ id, tier, quality, count }) => ({
              key: tier ? `${id}@t${tier}` : quality ? `${id}@q${quality}` : id,
              name:
                dropQualityPrefix(quality) + ITEMS[id].name + craftTierSuffix(tier),
              description: ITEMS[id].description ?? "",
              owned: count,
              unitPrice: getItemSellPrice(id),
              onSell: (qty) => onSellEquipment(id, qty, tier, quality),
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
