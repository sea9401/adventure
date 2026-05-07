"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PotionId } from "../data/potions";

export type InventoryState = {
  potions: Partial<Record<PotionId, number>>;
};

const STORAGE_KEY = "inventory.v1";

export const emptyInventory = (): InventoryState => ({ potions: {} });

function load(): InventoryState {
  if (typeof window === "undefined") return emptyInventory();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyInventory();
    const parsed = JSON.parse(raw) as Partial<InventoryState> | null;
    return { potions: parsed?.potions ?? {} };
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

  const add = useCallback((id: PotionId, n = 1) => {
    const cur = stateRef.current;
    const next: InventoryState = {
      ...cur,
      potions: { ...cur.potions, [id]: (cur.potions[id] ?? 0) + n },
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

  return { state, hydrated, add, consume, count, totalPotions };
}
