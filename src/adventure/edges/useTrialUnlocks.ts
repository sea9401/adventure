"use client";

import { useState } from "react";
import {
  TRIAL_UNLOCKS_KEY,
  migrateLegacyEdgeUnlocks,
  type TrialUnlocks,
} from "@/lib/trial-unlocks";
import type { RegionId } from "@/adventure/data/world";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";

const LEGACY_EDGE_UNLOCKS_KEY = "edge-unlocks.v2";

function readInitial(raw: unknown): TrialUnlocks {
  const out: TrialUnlocks = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v === true) out[k] = true;
    }
  }
  // 레거시 edge-unlocks.v2 가 localStorage 에 남아 있으면 from->to 키에서 to 추출.
  // (서버 동기화는 신규 키만 — 옛 키는 클라이언트에 남은 잔여만 흡수.)
  if (typeof window !== "undefined") {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_EDGE_UNLOCKS_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as Record<string, unknown> | null;
        migrateLegacyEdgeUnlocks(legacy, out);
      }
    } catch {}
  }
  return out;
}

export function useTrialUnlocks() {
  const initial = useSavedValue(TRIAL_UNLOCKS_KEY);
  const [unlocks, setUnlocks] = useState<TrialUnlocks>(() => readInitial(initial));
  useRemotePatch(TRIAL_UNLOCKS_KEY, unlocks);

  const markCleared = (regionId: RegionId) => {
    setUnlocks((prev) => (prev[regionId] ? prev : { ...prev, [regionId]: true }));
  };

  const isCleared = (regionId: RegionId): boolean =>
    unlocks[regionId] === true;

  return { unlocks, hydrated: true, markCleared, isCleared };
}
