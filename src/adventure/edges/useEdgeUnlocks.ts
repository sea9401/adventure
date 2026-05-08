"use client";

import { useEffect, useState } from "react";
import {
  edgeUnlockKey,
  loadEdgeUnlocks,
  saveEdgeUnlocks,
  type EdgeUnlocks,
} from "@/lib/edge-unlocks";
import type { RegionId } from "@/adventure/data/world";

export function useEdgeUnlocks() {
  const [unlocks, setUnlocks] = useState<EdgeUnlocks>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnlocks(loadEdgeUnlocks());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveEdgeUnlocks(unlocks);
  }, [hydrated, unlocks]);

  const unlock = (from: RegionId, to: RegionId) => {
    setUnlocks((prev) => ({ ...prev, [edgeUnlockKey(from, to)]: true }));
  };

  const isUnlocked = (from: RegionId, to: RegionId): boolean =>
    unlocks[edgeUnlockKey(from, to)] === true;

  return { unlocks, hydrated, unlock, isUnlocked };
}
