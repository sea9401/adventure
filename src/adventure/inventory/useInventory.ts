"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ItemId } from "../data/items";
import type { MaterialId } from "../data/materials";
import { POTION_MAX_PER_TYPE, type PotionId } from "../data/potions";

export type InventoryState = {
  potions: Partial<Record<PotionId, number>>;
  equipment: Partial<Record<ItemId, number>>;
  materials: Partial<Record<MaterialId, number>>;
};

const STORAGE_KEY = "inventory.v1";

export const emptyInventory = (): InventoryState => ({
  potions: {},
  equipment: {},
  materials: {},
});

function load(): InventoryState {
  if (typeof window === "undefined") return emptyInventory();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyInventory();
    const parsed = JSON.parse(raw) as Partial<InventoryState> | null;
    return {
      potions: parsed?.potions ?? {},
      equipment: parsed?.equipment ?? {},
      materials: parsed?.materials ?? {},
    };
  } catch {
    return emptyInventory();
  }
}

function save(state: InventoryState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function useInventory() {
  const [state, setState] = useState<InventoryState>(emptyInventory);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef<InventoryState>(emptyInventory());

  useEffect(() => {
    const loaded = load();
    stateRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    stateRef.current = state;
    if (!hydrated) return;
    save(state);
  }, [hydrated, state]);

  // 포션은 종류 별 POTION_MAX_PER_TYPE 까지만 보유 — 초과분은 silently 잘림.
  // 실제로 추가된 수량을 반환 (호출 측이 골드 환불·메시지 처리에 활용).
  const add = useCallback((id: PotionId, n = 1): number => {
    const cur = stateRef.current;
    const have = cur.potions[id] ?? 0;
    const room = Math.max(0, POTION_MAX_PER_TYPE - have);
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

  return {
    state,
    hydrated,
    add,
    consume,
    count,
    totalPotions,
    addEquipment,
    consumeEquipment,
    addMaterial,
    consumeMaterial,
    materialCount,
  };
}
