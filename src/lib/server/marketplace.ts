import { ITEMS, type ItemId, type EquipItem } from "@/adventure/data/items";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { getRecipeById, type Recipe } from "@/adventure/data/recipes";

// 거래 성사 수수료. 0 이면 수수료 없음 (UI 에서도 자동 숨김).
export const MARKETPLACE_FEE_RATE = 0;
export const MARKETPLACE_SLOT_LIMIT = 10;
export const MARKETPLACE_PRICE_MIN = 1;
export const MARKETPLACE_PRICE_MAX = 999_999_999;
// 매물 자동 유찰 시간 — 등록 후 이 시간이 지나면 expired 처리 + 판매자에게 환불 우편.
export const MARKETPLACE_LISTING_TTL_MS = 24 * 60 * 60 * 1000;

export type ItemKind = "equip" | "material" | "recipe";

export function isItemKind(s: string): s is ItemKind {
  return s === "equip" || s === "material" || s === "recipe";
}

export function getEquipDef(id: string): EquipItem | null {
  if (Object.prototype.hasOwnProperty.call(ITEMS, id)) {
    return ITEMS[id as ItemId];
  }
  return null;
}

export function getMaterialDef(id: string) {
  if (Object.prototype.hasOwnProperty.call(MATERIALS, id)) {
    return MATERIALS[id as MaterialId];
  }
  return null;
}

export function getRecipeDef(id: string): Recipe | undefined {
  return getRecipeById(id);
}

// 거래 가능 여부. 정의에 tradable === false 면 차단. 미지정 / true → 가능.
export function isTradable(kind: ItemKind, id: string): boolean {
  if (kind === "equip") {
    const def = getEquipDef(id);
    return def !== null && def.tradable !== false;
  }
  if (kind === "material") {
    const mat = getMaterialDef(id);
    if (!mat) return false;
    // Material 정의에 tradable 추가 시 동일 패턴.
    return !("tradable" in mat) || mat.tradable !== false;
  }
  // recipe
  const recipe = getRecipeDef(id);
  return recipe !== undefined && recipe.tradable !== false;
}

// 등록 시점 표시용 이름 스냅샷.
export function getItemName(kind: ItemKind, id: string): string | null {
  if (kind === "equip") return getEquipDef(id)?.name ?? null;
  if (kind === "material") return getMaterialDef(id)?.name ?? null;
  return getRecipeDef(id)?.name ?? null;
}

// 인벤토리 JSON 의 한 카테고리에서 item_id × quantity 만큼 차감 시도.
// 성공 시 새 카테고리 객체 반환, 실패 시 null.
export function deductFromCategory(
  category: Record<string, number> | undefined,
  itemId: string,
  quantity: number,
): Record<string, number> | null {
  const have = category?.[itemId] ?? 0;
  if (have < quantity) return null;
  const next = { ...(category ?? {}) };
  if (have - quantity <= 0) delete next[itemId];
  else next[itemId] = have - quantity;
  return next;
}

// 인벤토리 JSON 의 한 카테고리에 item_id × quantity 만큼 추가.
export function addToCategory(
  category: Record<string, number> | undefined,
  itemId: string,
  quantity: number,
): Record<string, number> {
  const next = { ...(category ?? {}) };
  next[itemId] = (next[itemId] ?? 0) + quantity;
  return next;
}

// inventory.v2 jsonb 의 안전한 모양. 호출 측에서 cast 후 사용.
export type InventoryShape = {
  potions?: Record<string, number>;
  equipment?: Record<string, number>;
  materials?: Record<string, number>;
};

// crafting.v2 jsonb 의 share-token 보조 헬퍼.
// shareable 누락된 레거시 데이터는 known 의 사본으로 fallback.
export type CraftingShape = {
  known?: unknown;
  shareable?: unknown;
  [key: string]: unknown;
};

export function getKnownArr(craft: CraftingShape | null | undefined): string[] {
  const k = craft?.known;
  return Array.isArray(k) ? (k as unknown[]).filter((v): v is string => typeof v === "string") : [];
}

// shareable 이 없으면 known 그대로 반환 (= 모두 풀 토큰).
export function getShareableArr(craft: CraftingShape | null | undefined): string[] {
  const s = craft?.shareable;
  if (Array.isArray(s)) {
    return (s as unknown[]).filter((v): v is string => typeof v === "string");
  }
  return getKnownArr(craft);
}

