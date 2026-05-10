"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConsumableId } from "../data/consumables";
import type { ItemId } from "../data/items";
import type { MaterialId } from "../data/materials";
import { potionMax, type PotionId } from "../data/potions";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";

export type InventoryState = {
  potions: Partial<Record<PotionId, number>>;
  equipment: Partial<Record<ItemId, number>>;
  materials: Partial<Record<MaterialId, number>>;
  consumables: Partial<Record<ConsumableId, number>>;
  // 종류별 포션 최대 보유 수의 추가 보너스. 보상으로 영구 누적.
  potionCapacityBonus?: number;
};

export const emptyInventory = (): InventoryState => ({
  potions: { potion_heal_s: 10 },
  equipment: {},
  materials: { branch: 1 },
  consumables: {},
});

function readInitial(raw: unknown): InventoryState {
  if (!raw || typeof raw !== "object") return emptyInventory();
  const parsed = raw as Partial<InventoryState>;
  return {
    potions: parsed.potions ?? {},
    equipment: parsed.equipment ?? {},
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
    addMaterial,
    consumeMaterial,
    materialCount,
    addConsumable,
    consumeConsumable,
    consumableCount,
    addPotionCapacity,
    potionMax: potionMaxValue,
  };
}
