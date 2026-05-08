export type RegionId =
  | "village"
  | "plains"
  | "forest"
  | "cave"
  | "lake"
  | "diola"
  | "ruins";

export type Biome =
  | "village"
  | "plains"
  | "forest"
  | "cave"
  | "lake"
  | "ruins";

export type RegionTag = "town";

export type Region = {
  id: RegionId;
  name: string;
  description: string;
  position: { x: number; y: number };
  biome: Biome;
  enemies: string[];
  tags?: RegionTag[];
  recommendedLevel?: number;
};

// 지역 간 이동에 걸리는 선행 조건. 방향성이 있으며 edge 의 from→to 진행에만 적용된다.
// 종류별 kind 로 구분 — 한 엣지에는 한 종류만 붙는다.
//
// 현재 구현된 종류:
// - "bestiary": 지정 지역의 모든 몬스터를 조우(encountered=true) 했어야 함.
// - "trial":   이동 시도 시 자동 전투 N전을 치러 모두 이겨야 함. 한 번 통과하면 영구 해금.
//
// 향후 확장 후보 (구현 X — 명칭만 예약):
// - "level":  최소 캐릭터 레벨.
// - "quest":  특정 퀘스트 완료.
// - "kills":  특정 몬스터 누적 처치 수.
// - "item":   특정 아이템 보유 (consume 옵션).
// - "fame":   최소 명성.
export type EdgeRequirement =
  | { kind: "bestiary"; regionId: RegionId }
  | { kind: "trial"; battles: number; enemiesFrom: RegionId }
  // "locked" — 영원히 통과 불가 (현재 미구현 지역, 콘텐츠 가림용).
  // reason 으로 UI 에 보여줄 한 줄 이유를 지정.
  | { kind: "locked"; reason?: string };

export type EdgeRequirementKind = EdgeRequirement["kind"];

export type RegionEdge = {
  from: RegionId;
  to: RegionId;
  requires?: EdgeRequirement;
};

export type WorldMap = {
  viewBox: { width: number; height: number };
  regions: Region[];
  edges: RegionEdge[];
};

export const WORLD_MAP: WorldMap = {
  viewBox: { width: 800, height: 500 },
  regions: [
    {
      id: "village",
      name: "시작 마을",
      description: "평화로운 작은 마을. 모든 모험의 시작점.",
      position: { x: 160, y: 380 },
      biome: "village",
      enemies: ["주정뱅이"],
      tags: ["town"],
      recommendedLevel: 1,
    },
    {
      id: "plains",
      name: "평야",
      description: "넓고 한가로운 풀밭. 들쥐와 슬라임이 어슬렁거린다.",
      position: { x: 380, y: 360 },
      biome: "plains",
      enemies: ["슬라임", "들개", "두더지"],
      recommendedLevel: 1,
    },
    {
      id: "cave",
      name: "동굴",
      description: "축축하고 어두운 광맥 동굴.",
      position: { x: 270, y: 200 },
      biome: "cave",
      enemies: ["박쥐", "동굴뱀"],
      recommendedLevel: 3,
    },
    {
      id: "forest",
      name: "외곽 숲",
      description: "햇빛이 새지 않는 짙은 숲.",
      position: { x: 580, y: 240 },
      biome: "forest",
      enemies: ["거미", "들개", "산적"],
      recommendedLevel: 5,
    },
    {
      id: "lake",
      name: "안개 호수",
      description: "잔잔한 수면 너머 무언가 보이는 호수.",
      position: { x: 440, y: 110 },
      biome: "lake",
      enemies: ["호수 님프"],
      recommendedLevel: 7,
    },
    {
      id: "diola",
      name: "디올라 마을",
      description: "안개 호수 가장자리에 자리한 작은 어촌. 호수에서 잡은 물고기로 살아간다.",
      position: { x: 660, y: 80 },
      biome: "village",
      enemies: [],
      tags: ["town"],
      recommendedLevel: 6,
    },
    {
      id: "ruins",
      name: "옛 폐허",
      description: "잊힌 문명의 흔적. 위험한 기운이 감돈다.",
      position: { x: 680, y: 400 },
      biome: "ruins",
      enemies: [],
    },
  ],
  edges: [
    { from: "village", to: "plains" },
    {
      from: "plains",
      to: "cave",
      requires: { kind: "trial", battles: 5, enemiesFrom: "cave" },
    },
    {
      from: "plains",
      to: "forest",
      requires: { kind: "trial", battles: 5, enemiesFrom: "forest" },
    },
    {
      from: "cave",
      to: "lake",
      requires: { kind: "trial", battles: 5, enemiesFrom: "lake" },
    },
    {
      from: "forest",
      to: "lake",
      requires: { kind: "trial", battles: 5, enemiesFrom: "lake" },
    },
    { from: "lake", to: "diola" },
    {
      from: "forest",
      to: "ruins",
      requires: { kind: "locked", reason: "아직 발길이 닿지 않은 곳이다." },
    },
  ],
};

export const START_REGION_ID: RegionId = "village";

export function getAdjacent(map: WorldMap, regionId: RegionId): RegionId[] {
  const adjacent = new Set<RegionId>();
  for (const edge of map.edges) {
    if (edge.from === regionId) adjacent.add(edge.to);
    if (edge.to === regionId) adjacent.add(edge.from);
  }
  return Array.from(adjacent);
}
