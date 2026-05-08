import type { RegionId } from "@/adventure/data/world";

// 영구적으로 해금된 엣지 키 집합. 시련(trial) 통과 후 다시 그 엣지를 지날 때
// 또 시련을 시키지 않도록 기록.
// 키 포맷: `${from}->${to}` — 방향성 있음.

export const EDGE_UNLOCKS_KEY = "edge-unlocks.v2";

export type EdgeUnlocks = Record<string, true>;

export function edgeUnlockKey(from: RegionId, to: RegionId): string {
  return `${from}->${to}`;
}

export function loadEdgeUnlocks(): EdgeUnlocks {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(EDGE_UNLOCKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as EdgeUnlocks | null;
    if (!parsed || typeof parsed !== "object") return {};
    const out: EdgeUnlocks = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === true) out[k] = true;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveEdgeUnlocks(map: EdgeUnlocks): void {
  try {
    localStorage.setItem(EDGE_UNLOCKS_KEY, JSON.stringify(map));
  } catch {}
}

export function isEdgeUnlocked(
  map: EdgeUnlocks,
  from: RegionId,
  to: RegionId,
): boolean {
  return map[edgeUnlockKey(from, to)] === true;
}
