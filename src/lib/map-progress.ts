import { START_REGION_ID, type RegionId } from "@/adventure/data/world";

export const MAP_STORAGE_KEY = "map.v1";

export type MapProgress = {
  currentRegionId: RegionId;
  visitedRegionIds: RegionId[];
};

export const initialMapProgress: MapProgress = {
  currentRegionId: START_REGION_ID,
  visitedRegionIds: [START_REGION_ID],
};

export function loadMapProgress(): MapProgress {
  try {
    const raw = localStorage.getItem(MAP_STORAGE_KEY);
    if (!raw) return initialMapProgress;
    const parsed = JSON.parse(raw) as Partial<MapProgress>;
    return {
      currentRegionId: parsed.currentRegionId ?? START_REGION_ID,
      visitedRegionIds:
        parsed.visitedRegionIds && parsed.visitedRegionIds.length > 0
          ? parsed.visitedRegionIds
          : [START_REGION_ID],
    };
  } catch {
    return initialMapProgress;
  }
}

export function saveMapProgress(progress: MapProgress): void {
  try {
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}
