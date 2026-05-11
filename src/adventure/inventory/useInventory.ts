"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConsumableId } from "../data/consumables";
import { ITEMS, type ItemId } from "../data/items";
import type { CraftTier } from "../data/craftQuality";
import type { MaterialId } from "../data/materials";
import { potionMax, type PotionId } from "../data/potions";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";

// 제작산 품질 등급 인스턴스 — itemId → (등급 문자열 "-2"|"-1"|"1"|"2" → 개수).
// 등급 0(일반)은 베이스와 동일하므로 별도로 두지 않고 equipment[] 에 합산한다.
export type CraftedEquipmentState = Partial<
  Record<ItemId, Partial<Record<string, number>>>
>;

// 비-기본(0 제외) 등급. craftedEquipment 가 담는 키.
const NON_ZERO_TIERS: readonly string[] = ["-2", "-1", "1", "2"];

export type InventoryState = {
  potions: Partial<Record<PotionId, number>>;
  equipment: Partial<Record<ItemId, number>>;
  /** 제작 품질 등급이 0(일반)이 아닌 장비. 항상 존재 — readInitial 에서 {} 로 채움. */
  craftedEquipment: CraftedEquipmentState;
  materials: Partial<Record<MaterialId, number>>;
  consumables: Partial<Record<ConsumableId, number>>;
  // 종류별 포션 최대 보유 수의 추가 보너스. 보상으로 영구 누적.
  potionCapacityBonus?: number;
};

export const emptyInventory = (): InventoryState => ({
  potions: { potion_heal_s: 10 },
  equipment: {},
  craftedEquipment: {},
  materials: { branch: 1 },
  consumables: {},
});

function readCraftedEquipment(raw: unknown): CraftedEquipmentState {
  if (!raw || typeof raw !== "object") return {};
  const out: CraftedEquipmentState = {};
  for (const [itemId, tiers] of Object.entries(raw as Record<string, unknown>)) {
    if (!(itemId in ITEMS) || !tiers || typeof tiers !== "object") continue;
    const tierMap: Partial<Record<string, number>> = {};
    for (const [t, n] of Object.entries(tiers as Record<string, unknown>)) {
      if (
        NON_ZERO_TIERS.includes(t) &&
        typeof n === "number" &&
        Number.isInteger(n) &&
        n > 0
      ) {
        tierMap[t] = n;
      }
    }
    if (Object.keys(tierMap).length) out[itemId as ItemId] = tierMap;
  }
  return out;
}

function readInitial(raw: unknown): InventoryState {
  if (!raw || typeof raw !== "object") return emptyInventory();
  const parsed = raw as Partial<InventoryState>;
  return {
    potions: parsed.potions ?? {},
    equipment: parsed.equipment ?? {},
    craftedEquipment: readCraftedEquipment(parsed.craftedEquipment),
    materials: parsed.materials ?? {},
    consumables: parsed.consumables ?? {},
    potionCapacityBonus: Math.max(0, parsed.potionCapacityBonus ?? 0),
  };
}

export function useInventory() {
  const initial = useSavedValue("inventory.v2");
  const [state, setState] = useState<InventoryState>(() => readInitial(initial));
  const stateRef = useRef<InventoryState>(state);
  useRemotePatch("inventory.v2", state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 포션은 종류 별 potionMax(bonus) 까지만 보유 — 초과분은 silently 잘림.
  // 실제로 추가된 수량을 반환 (호출 측이 골드 환불·메시지 처리에 활용).
  const add = useCallback((id: PotionId, n = 1): number => {
    const cur = stateRef.current;
    const have = cur.potions[id] ?? 0;
    const cap = potionMax(cur.potionCapacityBonus ?? 0);
    const room = Math.max(0, cap - have);
    const added = Math.min(n, room);
    if (added <= 0) return 0;
    const next: InventoryState = {
      ...cur,
      potions: { ...cur.potions, [id]: have + added },
    };
    stateRef.current = next;
    setState(next);
    return added;
  }, []);

  const addPotionCapacity = useCallback((n = 1) => {
    if (n <= 0) return;
    const cur = stateRef.current;
    const next: InventoryState = {
      ...cur,
      potionCapacityBonus: (cur.potionCapacityBonus ?? 0) + n,
    };
    stateRef.current = next;
    setState(next);
  }, []);

  const consume = useCallback((id: PotionId, n = 1): boolean => {
    const cur = stateRef.current;
    const have = cur.potions[id] ?? 0;
    if (have < n) return false;
    const next: InventoryState = {
      ...cur,
      potions: { ...cur.potions, [id]: have - n },
    };
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  const count = useCallback((id: PotionId): number => state.potions[id] ?? 0, [
    state,
  ]);

  const totalPotions = useCallback((): number => {
    let total = 0;
    for (const v of Object.values(state.potions)) total += v ?? 0;
    return total;
  }, [state]);

  const addEquipment = useCallback((id: ItemId, n = 1) => {
    const cur = stateRef.current;
    const next: InventoryState = {
      ...cur,
      equipment: {
        ...cur.equipment,
        [id]: (cur.equipment[id] ?? 0) + n,
      },
    };
    stateRef.current = next;
    setState(next);
  }, []);

  const consumeEquipment = useCallback((id: ItemId, n = 1): boolean => {
    const cur = stateRef.current;
    const have = cur.equipment[id] ?? 0;
    if (have < n) return false;
    const next: InventoryState = {
      ...cur,
      equipment: { ...cur.equipment, [id]: have - n },
    };
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  // 제작산 등급 인스턴스. tier 0(일반)은 equipment[] 와 동일하므로 그쪽으로 합산.
  const addCraftedEquipment = useCallback(
    (id: ItemId, tier: CraftTier, n = 1) => {
      if (n <= 0) return;
      const cur = stateRef.current;
      if (tier === 0) {
        const next: InventoryState = {
          ...cur,
          equipment: { ...cur.equipment, [id]: (cur.equipment[id] ?? 0) + n },
        };
        stateRef.current = next;
        setState(next);
        return;
      }
      const key = String(tier);
      const tierMap = { ...(cur.craftedEquipment[id] ?? {}) };
      tierMap[key] = (tierMap[key] ?? 0) + n;
      const next: InventoryState = {
        ...cur,
        craftedEquipment: { ...cur.craftedEquipment, [id]: tierMap },
      };
      stateRef.current = next;
      setState(next);
    },
    [],
  );

  const consumeCraftedEquipment = useCallback(
    (id: ItemId, tier: CraftTier, n = 1): boolean => {
      if (tier === 0) return consumeEquipment(id, n);
      const cur = stateRef.current;
      const key = String(tier);
      const have = cur.craftedEquipment[id]?.[key] ?? 0;
      if (have < n) return false;
      const tierMap = { ...(cur.craftedEquipment[id] ?? {}) };
      const left = have - n;
      if (left > 0) tierMap[key] = left;
      else delete tierMap[key];
      const crafted = { ...cur.craftedEquipment };
      if (Object.keys(tierMap).length) crafted[id] = tierMap;
      else delete crafted[id];
      const next: InventoryState = { ...cur, craftedEquipment: crafted };
      stateRef.current = next;
      setState(next);
      return true;
    },
    [consumeEquipment],
  );

  const addMaterial = useCallback((id: MaterialId, n = 1) => {
    const cur = stateRef.current;
    const next: InventoryState = {
      ...cur,
      materials: {
        ...cur.materials,
        [id]: (cur.materials[id] ?? 0) + n,
      },
    };
    stateRef.current = next;
    setState(next);
  }, []);

  const consumeMaterial = useCallback((id: MaterialId, n = 1): boolean => {
    const cur = stateRef.current;
    const have = cur.materials[id] ?? 0;
    if (have < n) return false;
    const next: InventoryState = {
      ...cur,
      materials: { ...cur.materials, [id]: have - n },
    };
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  const materialCount = useCallback(
    (id: MaterialId): number => state.materials[id] ?? 0,
    [state],
  );

  // 제작산 등급 인스턴스 보유 수 — 등급 합산(equipment[] 의 무등급/일반은 제외).
  const craftedTotalCount = useCallback(
    (id: ItemId): number => {
      const tierMap = state.craftedEquipment[id];
      if (!tierMap) return 0;
      let total = 0;
      for (const v of Object.values(tierMap)) total += v ?? 0;
      return total;
    },
    [state],
  );

  const addConsumable = useCallback((id: ConsumableId, n = 1) => {
    if (n <= 0) return;
    const cur = stateRef.current;
    const next: InventoryState = {
      ...cur,
      consumables: {
        ...cur.consumables,
        [id]: (cur.consumables[id] ?? 0) + n,
      },
    };
    stateRef.current = next;
    setState(next);
  }, []);

  const consumeConsumable = useCallback(
    (id: ConsumableId, n = 1): boolean => {
      const cur = stateRef.current;
      const have = cur.consumables[id] ?? 0;
      if (have < n) return false;
      const next: InventoryState = {
        ...cur,
        consumables: { ...cur.consumables, [id]: have - n },
      };
      stateRef.current = next;
      setState(next);
      return true;
    },
    [],
  );

  const consumableCount = useCallback(
    (id: ConsumableId): number => state.consumables[id] ?? 0,
    [state],
  );

  // 서버 권위 액션(상점 등)의 응답으로 받은 inventory.v2 값으로 통째 교체.
  // 이후 useRemotePatch 가 동일 값을 다시 PATCH 하지만 서버 version 과 409 재시도로 자가 수렴.
  const replaceFromSaved = useCallback((raw: unknown) => {
    const next = readInitial(raw);
    stateRef.current = next;
    setState(next);
  }, []);

  const potionMaxValue = potionMax(state.potionCapacityBonus ?? 0);

  return {
    state,
    hydrated: true,
    add,
    consume,
    count,
    totalPotions,
    addEquipment,
    consumeEquipment,
    addCraftedEquipment,
    consumeCraftedEquipment,
    craftedTotalCount,
    addMaterial,
    consumeMaterial,
    materialCount,
    addConsumable,
    consumeConsumable,
    consumableCount,
    addPotionCapacity,
    replaceFromSaved,
    potionMax: potionMaxValue,
  };
}
