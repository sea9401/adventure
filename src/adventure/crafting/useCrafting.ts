"use client";

import { useCallback, useState } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import { emptyCraftingState, type CraftingState } from "./storage";

function readInitial(raw: unknown): CraftingState {
  if (!raw || typeof raw !== "object") return emptyCraftingState();
  const parsed = raw as Partial<CraftingState>;
  const known = Array.isArray(parsed.known) ? parsed.known : [];
  return {
    known,
    crafted: Array.isArray(parsed.crafted) ? parsed.crafted : [],
    // 레거시 데이터: shareable 누락 → 알고 있는 것 모두 1회 공유 가능 상태.
    shareable: Array.isArray(parsed.shareable) ? parsed.shareable : [...known],
    boldQuestComplete: !!parsed.boldQuestComplete,
    boldSlimeQuestComplete: !!parsed.boldSlimeQuestComplete,
  };
}

export function useCrafting() {
  const initial = useSavedValue("crafting.v2");
  const [state, setState] = useState<CraftingState>(() => readInitial(initial));
  useRemotePatch("crafting.v2", state);

  // 학습 — 1차 출처 (NPC/퀘스트/드랍 보상). known + shareable 둘 다 갱신.
  // 같은 id 재호출 = 다시 습득 → known 은 no-op, shareable 만 충전.
  const learnRecipe = useCallback((id: string) => {
    setState((prev) => {
      const knownHas = prev.known.includes(id);
      const shareableHas = prev.shareable.includes(id);
      if (knownHas && shareableHas) return prev;
      return {
        ...prev,
        known: knownHas ? prev.known : [...prev.known, id],
        shareable: shareableHas ? prev.shareable : [...prev.shareable, id],
      };
    });
  }, []);

  // 거래/우편으로 받은 제작서 — known 만 갱신, shareable 은 건드리지 않는다.
  // (= 받은 사람이 즉시 다시 거래에 올리는 무한 laundering 방지)
  const learnRecipeFromTrade = useCallback((id: string) => {
    setState((prev) =>
      prev.known.includes(id)
        ? prev
        : { ...prev, known: [...prev.known, id] },
    );
  }, []);

  const consumeShare = useCallback((id: string) => {
    setState((prev) =>
      prev.shareable.includes(id)
        ? { ...prev, shareable: prev.shareable.filter((x) => x !== id) }
        : prev,
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
    canShare: (id: string) => state.shareable.includes(id),
    hasCrafted: (id: string) => state.crafted.includes(id),
    learnRecipe,
    learnRecipeFromTrade,
    consumeShare,
    markCrafted,
    setBoldQuestComplete,
    setBoldSlimeQuestComplete,
  };
}
