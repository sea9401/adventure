"use client";

import { useState } from "react";
import { Coins } from "@phosphor-icons/react";
import type { PotionId } from "./data/potions";
import type { MaterialId } from "./data/materials";
import type { ItemId } from "./data/items";
import type { CraftTier } from "./data/craftQuality";
import type { DropQuality } from "./data/dropQuality";
import type { ConsumableId } from "./data/consumables";
import type { InventoryState } from "./inventory/useInventory";
import { TabBar } from "@/components/ui/TabBar";
import { BuyTab } from "./shop/BuyTab";
import { SellTab } from "./shop/SellTab";

type ShopTabKey = "buy" | "sell";

const TABS: { key: ShopTabKey; label: string }[] = [
  { key: "buy", label: "구매" },
  { key: "sell", label: "판매" },
];

export function ShopView({
  gold,
  inventory,
  isMaterialBuyable,
  craftingGates,
  onPurchasePotion,
  onPurchaseMaterial,
  onPurchaseConsumable,
  onPurchaseEquipment,
  onSellPotion,
  onSellMaterial,
  onSellEquipment,
}: {
  gold: number;
  inventory: InventoryState;
  isMaterialBuyable: (id: MaterialId) => boolean;
  craftingGates: { boldQuestComplete: boolean };
  onPurchasePotion: (id: PotionId, quantity: number) => void;
  onPurchaseMaterial: (id: MaterialId, quantity: number) => void;
  onPurchaseConsumable: (id: ConsumableId, quantity: number) => void;
  onPurchaseEquipment: (id: ItemId, quantity: number) => void;
  onSellPotion: (id: PotionId, quantity: number) => void;
  onSellMaterial: (id: MaterialId, quantity: number) => void;
  onSellEquipment: (
    id: ItemId,
    quantity: number,
    craftTier?: CraftTier,
    dropQuality?: DropQuality,
  ) => void;
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
          craftingGates={craftingGates}
          onPurchasePotion={onPurchasePotion}
          onPurchaseMaterial={onPurchaseMaterial}
          onPurchaseConsumable={onPurchaseConsumable}
          onPurchaseEquipment={onPurchaseEquipment}
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
