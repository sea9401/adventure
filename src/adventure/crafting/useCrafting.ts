"use client";

import { useCallback, useEffect, useState } from "react";
import {
  emptyCraftingState,
  loadCraftingState,
  saveCraftingState,
  type CraftingState,
} from "./storage";

export function useCrafting() {
  const [state, setState] = useState<CraftingState>(emptyCraftingState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadCraftingState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCraftingState(state);
  }, [hydrated, state]);

  const learnRecipe = useCallback((id: string) => {
    setState((prev) =>
      prev.known.includes(id)
        ? prev
        : { ...prev, known: [...prev.known, id] },
    );
  }, []);

  const markCrafted = useCallback((id: string) => {
    setState((prev) =>
      prev.crafted.includes(id)
        ? prev
        : { ...prev, crafted: [...prev.crafted, id] },
    );
  }, []);

  const setBoldQuestComplete = useCallback(() => {
    setState((prev) =>
      prev.boldQuestComplete ? prev : { ...prev, boldQuestComplete: true },
    );
  }, []);

  return {
    state,
    hydrated,
    knows: (id: string) => state.known.includes(id),
    hasCrafted: (id: string) => state.crafted.includes(id),
    learnRecipe,
    markCrafted,
    setBoldQuestComplete,
  };
}
