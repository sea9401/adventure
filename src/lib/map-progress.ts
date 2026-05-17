import { START_REGION_ID, type RegionId } from "@/adventure/data/world";

export const MAP_STORAGE_KEY = "map.v2";

export type MapProgress = {
  currentRegionId: RegionId;
  visitedRegionIds: RegionId[];
  // 패배 시 복귀할 마을. 마을 치료소에서 "이곳을 복귀 지점으로 설정" 으로 변경.
  // undefined / 미저장 시 START_REGION_ID 가 디폴트.
  respawnRegionId?: RegionId;
};

export const initialMapProgress: MapProgress = {
  currentRegionId: START_REGION_ID,
  visitedRegionIds: [START_REGION_ID],
  respawnRegionId: START_REGION_ID,
};
