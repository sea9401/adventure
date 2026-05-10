import type { RegionId } from "@/adventure/data/world";

// "시련 통과한 지역" 집합. 키는 RegionId — 그 지역 적과의 5전 시련을 한 번 통과하면
// 같은 enemiesFrom 을 요구하는 모든 trial 엣지가 자동 해금된다 (방향 무관).
//
// 예: 호수(lake) 시련을 cave→lake 진입로에서 통과하면, 이후 forest→lake 도 자동 통과.
//
// 레거시 — 이전에는 `${from}->${to}` 키로 방향별로 저장 (edge-unlocks.v2). 마이그레이션은
// useTrialUnlocks 훅에서 처리: 현재 모든 trial edge 가 enemiesFrom === to 라 `to` 만
// 추출하면 충분.

export const TRIAL_UNLOCKS_KEY = "trial-unlocks.v1";

export type TrialUnlocks = Record<string, true>;

export function isTrialCleared(
  map: TrialUnlocks,
  regionId: RegionId,
): boolean {
  return map[regionId] === true;
}

// 레거시 edge-unlocks.v2 의 `from->to` 키에서 to (= 통과한 지역) 만 추출.
// 미사용 키나 형식이 깨진 entry 는 무시.
export function migrateLegacyEdgeUnlocks(
  legacy: Record<string, unknown> | null | undefined,
  into: TrialUnlocks,
): void {
  if (!legacy || typeof legacy !== "object") return;
  for (const [k, v] of Object.entries(legacy)) {
    if (v !== true) continue;
    const idx = k.indexOf("->");
    if (idx <= 0) continue;
    const to = k.slice(idx + 2);
    if (to) into[to] = true;
  }
}
