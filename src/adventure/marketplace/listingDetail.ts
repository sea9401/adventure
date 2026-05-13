import { ITEMS, type ItemId } from "@/adventure/data/items";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { POTIONS } from "@/adventure/data/potions";
import { getRecipeById } from "@/adventure/data/recipes";
import { craftVarianceSummary } from "@/adventure/data/craftQuality";
import type { Listing } from "./types";

// 매물 카드를 클릭하면 펼쳐 보여줄 상세 — 장비 옵션 / 제작서 결과 / 재료 설명.
export type ListingDetail = {
  title?: string;
  lines: { label: string; value: string }[];
  /** 제작 품질 변동 안내 ("공격력 +6~+10" 식). */
  variance?: string;
  description?: string;
};

export function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function listingDetail(item: Listing): ListingDetail | null {
  if (item.itemKind === "equip") {
    if (!hasOwn(ITEMS, item.itemId)) return null;
    const def = ITEMS[item.itemId as ItemId];
    return { lines: [...def.stats], description: def.description };
  }
  if (item.itemKind === "recipe") {
    const r = getRecipeById(item.itemId);
    if (!r) return null;
    if (r.result.kind === "equipment") {
      const def = ITEMS[r.result.itemId];
      return {
        title: `제작 결과: ${def.name}`,
        lines: [...def.stats],
        variance: craftVarianceSummary(def, r) ?? undefined,
        description: def.description,
      };
    }
    const p = POTIONS[r.result.potionId];
    const qty = r.result.quantity;
    return {
      title: `제작 결과: ${p.name}${qty > 1 ? ` ×${qty}` : ""}`,
      lines: [],
      description: p.description,
    };
  }
  if (item.itemKind === "material") {
    if (!hasOwn(MATERIALS, item.itemId)) return null;
    return { lines: [], description: MATERIALS[item.itemId as MaterialId].description };
  }
  return null;
}
