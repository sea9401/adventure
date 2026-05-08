"use client";

import { useCallback, useState } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import { emptyCraftingState, type CraftingState } from "./storage";

function readInitial(raw: unknown): CraftingState {
  if (!raw || typeof raw !== "object") return emptyCraftingState();
  const parsed = raw as Partial<CraftingState>;
  return {
    known: Array.isArray(parsed.known) ? parsed.known : [],
    crafted: Array.isArray(parsed.crafted) ? parsed.crafted : [],
    boldQuestComplete: !!parsed.boldQuestComplete,
    boldSlimeQuestComplete: !!parsed.boldSlimeQuestComplete,
  };
}

export function useCrafting() {
  const initial = useSavedValue("crafting.v2");
  const [state, setState] = useState<CraftingState>(() => readInitial(initial));
  useRemotePatch("crafting.v2", state);

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

  const setBoldSlimeQuestComplete = useCallback(() => {
    setState((prev) =>
      prev.boldSlimeQuestComplete
        ? prev
        : { ...prev, boldSlimeQuestComplete: true },
    );
  }, []);

  return {
    state,
    hydrated: true,
    knows: (id: string) => state.known.includes(id),
    hasCrafted: (id: string) => state.crafted.includes(id),
    learnRecipe,
    markCrafted,
    setBoldQuestComplete,
    setBoldSlimeQuestComplete,
  };
}
