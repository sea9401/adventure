// 상점 판매가 매핑. 등록되지 않은 아이템은 0G(인벤토리 정리/버리기 용도).
// 향후 카테고리별 일괄 비율(예: "구매가의 30%") 정책으로 바꿔도 호출부는 그대로.

import type { ItemId } from "./items";
import type { MaterialId } from "./materials";
import type { PotionId } from "./potions";

const POTION_SELL: Partial<Record<PotionId, number>> = {
  potion_heal_s: 1,
};

const MATERIAL_SELL: Partial<Record<MaterialId, number>> = {};

const ITEM_SELL: Partial<Record<ItemId, number>> = {};

export function getPotionSellPrice(id: PotionId): number {
  return POTION_SELL[id] ?? 0;
}

export function getMaterialSellPrice(id: MaterialId): number {
  return MATERIAL_SELL[id] ?? 0;
}

export function getItemSellPrice(id: ItemId): number {
  return ITEM_SELL[id] ?? 0;
}
