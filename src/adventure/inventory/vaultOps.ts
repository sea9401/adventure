// 도감 보관함 ↔ 인벤토리 이동의 순수 함수. useInventory 의 depositToVault / withdrawFromVault 가
// 이 함수들을 감싸 setState 한다. 분리한 이유는 (1) 테스트 가능, (2) 한 번의 setState 로 atomic 갱신.

import type { ItemId } from "../data/items";
import type { CraftTier } from "../data/craftQuality";
import type { DropQuality } from "../data/dropQuality";
import type { InventoryState } from "./useInventory";

// (tier, quality) → 변형 키. discoveredEquipment.variantKey 와 동일 규약.
export function vaultVariantKey(
  tier?: CraftTier | null,
  quality?: DropQuality | null,
): string {
  if (tier != null && tier !== 0) return `c${tier}`;
  if (quality != null && quality !== 0) return `d${quality}`;
  return "base";
}

// 변형 키 → (tier, quality). 모르는 키는 base 취급.
export function parseVaultVariantKey(key: string): {
  tier?: CraftTier;
  quality?: DropQuality;
} {
  if (key === "base") return {};
  if (key[0] === "c") {
    const t = Number(key.slice(1));
    if (t === -2 || t === -1 || t === 1 || t === 2) return { tier: t as CraftTier };
    return {};
  }
  if (key[0] === "d") {
    const q = Number(key.slice(1));
    if (q === 1 || q === 2) return { quality: q as DropQuality };
    return {};
  }
  return {};
}

// 인벤토리 (tier, quality) 슬롯에서 n 개 차감. 부족하면 null. 0 tier·0 quality 는 equipment[] 에 합산.
function consumeEquipmentSlot(
  cur: InventoryState,
  id: ItemId,
  tier?: CraftTier | null,
  quality?: DropQuality | null,
  n = 1,
): InventoryState | null {
  if (tier != null && tier !== 0) {
    const key = String(tier);
    const have = cur.craftedEquipment[id]?.[key] ?? 0;
    if (have < n) return null;
    const tierMap = { ...(cur.craftedEquipment[id] ?? {}) };
    const left = have - n;
    if (left > 0) tierMap[key] = left;
    else delete tierMap[key];
    const crafted = { ...cur.craftedEquipment };
    if (Object.keys(tierMap).length) crafted[id] = tierMap;
    else delete crafted[id];
    return { ...cur, craftedEquipment: crafted };
  }
  if (quality != null && quality !== 0) {
    const key = String(quality);
    const have = cur.droppedEquipment[id]?.[key] ?? 0;
    if (have < n) return null;
    const map = { ...(cur.droppedEquipment[id] ?? {}) };
    const left = have - n;
    if (left > 0) map[key] = left;
    else delete map[key];
    const dropped = { ...cur.droppedEquipment };
    if (Object.keys(map).length) dropped[id] = map;
    else delete dropped[id];
    return { ...cur, droppedEquipment: dropped };
  }
  const have = cur.equipment[id] ?? 0;
  if (have < n) return null;
  return { ...cur, equipment: { ...cur.equipment, [id]: have - n } };
}

function addEquipmentSlot(
  cur: InventoryState,
  id: ItemId,
  tier?: CraftTier,
  quality?: DropQuality,
  n = 1,
): InventoryState {
  if (tier != null && tier !== 0) {
    const key = String(tier);
    const tierMap = { ...(cur.craftedEquipment[id] ?? {}) };
    tierMap[key] = (tierMap[key] ?? 0) + n;
    return {
      ...cur,
      craftedEquipment: { ...cur.craftedEquipment, [id]: tierMap },
    };
  }
  if (quality != null && quality !== 0) {
    const key = String(quality);
    const map = { ...(cur.droppedEquipment[id] ?? {}) };
    map[key] = (map[key] ?? 0) + n;
    return {
      ...cur,
      droppedEquipment: { ...cur.droppedEquipment, [id]: map },
    };
  }
  return {
    ...cur,
    equipment: { ...cur.equipment, [id]: (cur.equipment[id] ?? 0) + n },
  };
}

function consumeFromVault(
  cur: InventoryState,
  id: ItemId,
  variantKey: string,
  n = 1,
): InventoryState | null {
  const have = cur.vault[id]?.[variantKey] ?? 0;
  if (have < n) return null;
  const vMap = { ...(cur.vault[id] ?? {}) };
  const left = have - n;
  if (left > 0) vMap[variantKey] = left;
  else delete vMap[variantKey];
  const vault = { ...cur.vault };
  if (Object.keys(vMap).length) vault[id] = vMap;
  else delete vault[id];
  return { ...cur, vault };
}

function addToVault(
  cur: InventoryState,
  id: ItemId,
  variantKey: string,
  n = 1,
): InventoryState {
  const vMap = { ...(cur.vault[id] ?? {}) };
  vMap[variantKey] = (vMap[variantKey] ?? 0) + n;
  return { ...cur, vault: { ...cur.vault, [id]: vMap } };
}

// 인벤 → vault. 인벤 부족이면 null.
export function depositToVaultPure(
  cur: InventoryState,
  id: ItemId,
  tier?: CraftTier,
  quality?: DropQuality,
  n = 1,
): InventoryState | null {
  if (n <= 0) return null;
  const consumed = consumeEquipmentSlot(cur, id, tier, quality, n);
  if (!consumed) return null;
  return addToVault(consumed, id, vaultVariantKey(tier, quality), n);
}

// vault → 인벤. vault 부족이면 null.
export function withdrawFromVaultPure(
  cur: InventoryState,
  id: ItemId,
  variantKey: string,
  n = 1,
): InventoryState | null {
  if (n <= 0) return null;
  const consumed = consumeFromVault(cur, id, variantKey, n);
  if (!consumed) return null;
  const { tier, quality } = parseVaultVariantKey(variantKey);
  return addEquipmentSlot(consumed, id, tier, quality, n);
}
