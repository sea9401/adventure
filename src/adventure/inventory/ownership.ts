import { ITEMS, isLuckyFind, type EquipItem, type ItemId } from "../data/items";
import type { EquippedSlots } from "../character/types";
import type { useInventory } from "./useInventory";

type InvState = ReturnType<typeof useInventory>["state"];

const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

function itemIdByName(name: string): ItemId | undefined {
  return ITEM_IDS.find((id) => ITEMS[id].name === name);
}

// ITEMS 의 const-narrow 타입에선 rarity 미지정 아이템에 필드가 안 보여서 EquipItem 으로 받는다.
function isUnique(id: ItemId): boolean {
  return isLuckyFind(ITEMS[id] as EquipItem);
}

// 인벤토리(무등급·제작산·드랍산 맵) + 장착 슬롯 어디에든 해당 장비를 보유 중인지.
export function ownsEquipment(
  inv: InvState,
  slots: EquippedSlots,
  itemId: ItemId,
): boolean {
  if ((inv.equipment[itemId] ?? 0) > 0) return true;
  for (const m of [inv.craftedEquipment, inv.droppedEquipment]) {
    const grades = m[itemId];
    if (grades && Object.values(grades).some((n) => (n ?? 0) > 0)) return true;
  }
  const name = ITEMS[itemId]?.name;
  for (const s of [slots.weapon, slots.armor, slots.accessory]) {
    if (s && name && s.name === name) return true;
  }
  return false;
}

// 장비 보유량을 itemId → 총개수 로 합산 — 무등급(equipment) + 제작산(±tier) + 드랍산(고품질) 전부.
// 제작 재료 충족 판정에 쓴다 (서버 craft.ts 도 셋을 합산해 검사하므로 UI도 동일하게 맞춤).
export function equipmentCountsAllGrades(
  inv: InvState,
): Partial<Record<ItemId, number>> {
  const out: Partial<Record<ItemId, number>> = { ...inv.equipment };
  for (const m of [inv.craftedEquipment, inv.droppedEquipment]) {
    for (const id of Object.keys(m) as ItemId[]) {
      const grades = m[id];
      if (!grades) continue;
      const sum = Object.values(grades).reduce<number>((a, b) => a + (b ?? 0), 0);
      if (sum > 0) out[id] = (out[id] ?? 0) + sum;
    }
  }
  return out;
}

// 보유 중인 unique("유실된 명품") 등급 장비의 종류 수 (인스턴스 아닌 distinct itemId).
export function ownedUniqueItemCount(inv: InvState, slots: EquippedSlots): number {
  const ids = new Set<ItemId>();
  for (const id of Object.keys(inv.equipment) as ItemId[]) {
    if ((inv.equipment[id] ?? 0) > 0 && isUnique(id)) ids.add(id);
  }
  for (const m of [inv.craftedEquipment, inv.droppedEquipment]) {
    for (const id of Object.keys(m) as ItemId[]) {
      const grades = m[id];
      if (grades && Object.values(grades).some((n) => (n ?? 0) > 0) && isUnique(id))
        ids.add(id);
    }
  }
  for (const s of [slots.weapon, slots.armor, slots.accessory]) {
    if (s && isLuckyFind(s)) {
      const id = itemIdByName(s.name);
      if (id) ids.add(id);
    }
  }
  return ids.size;
}
