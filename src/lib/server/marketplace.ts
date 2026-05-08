import { ITEMS, type ItemId, type EquipItem } from "@/adventure/data/items";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";

// 거래 성사 수수료. 0 이면 수수료 없음 (UI 에서도 자동 숨김).
export const MARKETPLACE_FEE_RATE = 0;
export const MARKETPLACE_SLOT_LIMIT = 10;
export const MARKETPLACE_PRICE_MIN = 1;
export const MARKETPLACE_PRICE_MAX = 999_999_999;

export type ItemKind = "equip" | "material";

export function isItemKind(s: string): s is ItemKind {
  return s === "equip" || s === "material";
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

// 거래 가능 여부. 정의에 tradable === false 면 차단. 미지정 / true → 가능.
export function isTradable(kind: ItemKind, id: string): boolean {
  if (kind === "equip") {
    const def = getEquipDef(id);
    return def !== null && def.tradable !== false;
  }
  const mat = getMaterialDef(id);
  if (!mat) return false;
  // Material 정의에 tradable 추가 시 동일 패턴.
  return !("tradable" in mat) || mat.tradable !== false;
}

// 등록 시점 표시용 이름 스냅샷.
export function getItemName(kind: ItemKind, id: string): string | null {
  if (kind === "equip") return getEquipDef(id)?.name ?? null;
  return getMaterialDef(id)?.name ?? null;
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

// 장비 슬롯에 장착 중인 itemId 목록 (한 슬롯이라도 매칭되면 막기 위함).
// character.v2 의 equipped.{weapon,armor,accessory} 는 EquipItem | null 형태로
// 저장되며 ID 는 별도 필드가 없어 name 매칭으로 ID 를 역추적해야 한다.
export function getEquippedItemIds(
  character: unknown,
): Set<string> {
  const equipped = (character as { equipped?: Record<string, unknown> } | null)
    ?.equipped;
  if (!equipped || typeof equipped !== "object") return new Set();
  const result = new Set<string>();
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const slotItem = (equipped as Record<string, unknown>)[slot];
    if (!slotItem || typeof slotItem !== "object") continue;
    const name = (slotItem as { name?: unknown }).name;
    if (typeof name !== "string") continue;
    for (const [id, def] of Object.entries(ITEMS)) {
      if (def.name === name) {
        result.add(id);
        break;
      }
    }
  }
  return result;
}
