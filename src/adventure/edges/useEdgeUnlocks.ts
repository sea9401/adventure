"use client";

import { useState } from "react";
import { edgeUnlockKey, type EdgeUnlocks } from "@/lib/edge-unlocks";
import type { RegionId } from "@/adventure/data/world";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";

function readInitial(raw: unknown): EdgeUnlocks {
  if (!raw || typeof raw !== "object") return {};
  const out: EdgeUnlocks = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === true) out[k] = true;
  }
  return out;
}

export function useEdgeUnlocks() {
  const initial = useSavedValue("edge-unlocks.v1");
  const [unlocks, setUnlocks] = useState<EdgeUnlocks>(() => readInitial(initial));
  useRemotePatch("edge-unlocks.v1", unlocks);

  const unlock = (from: RegionId, to: RegionId) => {
    setUnlocks((prev) => ({ ...prev, [edgeUnlockKey(from, to)]: true }));
  };

  const isUnlocked = (from: RegionId, to: RegionId): boolean =>
    unlocks[edgeUnlockKey(from, to)] === true;

  return { unlocks, hydrated: true, unlock, isUnlocked };
}
