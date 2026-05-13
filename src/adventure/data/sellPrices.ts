// 상점 판매가 매핑. 등록되지 않은 아이템은 0G(인벤토리 정리/버리기 용도).
// 향후 카테고리별 일괄 비율(예: "구매가의 30%") 정책으로 바꿔도 호출부는 그대로.

import type { ItemId } from "./items";
import type { MaterialId } from "./materials";
import type { PotionId } from "./potions";

const POTION_SELL: Partial<Record<PotionId, number>> = {
  potion_heal_s: 1,
  potion_heal_m: 2,
  potion_heal_l: 5,
};

const MATERIAL_SELL: Partial<Record<MaterialId, number>> = {
  // 0G 항목(나뭇가지/슬라임 조각/낡은 못)은 생략 — 디폴트가 0.
  slime_core: 1,
  wilddog_hide: 1,
  wilddog_fang: 2,
  spider_silk: 2,
  bat_eye: 2,
  hard_crystal: 3,
  fairy_dust: 3,
  ruin_fragment: 4,
  soul_crystal: 5,
  mana_crystal: 10,
  giant_scale: 15,
  unbong_ore: 6,
  sancho_blossom: 6,
  wind_mana_stone: 7,
  tough_hide: 7,
  wolf_king_fang: 20,
};

const ITEM_SELL: Partial<Record<ItemId, number>> = {
  // 상점 입문 장비 — 구매가(14G)의 약 20% 환불.
  worn_dagger: 3,
  quilted_vest: 3,
};

export function getPotionSellPrice(id: PotionId): number {
  return POTION_SELL[id] ?? 0;
}

export function getMaterialSellPrice(id: MaterialId): number {
  return MATERIAL_SELL[id] ?? 0;
}

export function getItemSellPrice(id: ItemId): number {
  return ITEM_SELL[id] ?? 0;
}
