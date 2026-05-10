export type RegionId =
  | "village"
  | "plains"
  | "forest"
  | "cave"
  | "deep_cave"
  | "lake"
  | "diola"
  | "ruins"
  | "highland"
  | "canyon"
  | "unhyang";

export type Biome =
  | "village"
  | "plains"
  | "forest"
  | "cave"
  | "lake"
  | "ruins"
  | "mountain";

export type RegionTag = "town";

export type Region = {
  id: RegionId;
  name: string;
  description: string;
  position: { x: number; y: number };
  biome: Biome;
  enemies: string[];
  /**
   * 등장 가중치. 키는 enemies 의 항목명, 값은 양수.
   * 미지정/0/누락된 항목은 1로 취급. 모든 가중치가 0이면 첫 번째 적 반환.
   * 예: { "골렘": 20, "망령": 40, "늑대": 40 } → 골렘은 평균보다 적게 등장.
   */
  encounterWeights?: Partial<Record<string, number>>;
  /**
   * 보스 인카운터 — 별도 도전 버튼으로 진입. 일반 자동 사냥 풀에서 제외된다.
   * 일일 입장 횟수 제한이 있으며 자정(클라이언트 로컬) 기준 reset.
   * boss.monsterName 은 MONSTERS 의 키.
   */
  boss?: {
    monsterName: string;
    dailyEntryLimit: number;
  };
  tags?: RegionTag[];
  recommendedLevel?: number;
};

// 지역 간 이동에 걸리는 선행 조건. 방향성이 있으며 edge 의 from→to 진행에만 적용된다.
// 종류별 kind 로 구분 — 한 엣지에는 한 종류만 붙는다.
//
// 현재 구현된 종류:
// - "bestiary": 지정 지역의 모든 몬스터를 조우(encountered=true) 했어야 함.
// - "trial":   이동 시도 시 자동 전투 N전을 치러 모두 이겨야 함. 한 번 통과하면 영구 해금.
// - "story":   특정 storyFlag 가 켜져야 통과. NPC 대화 분기로 해금하는 지역.
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
  | { kind: "story"; flagId: string; reason?: string }
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
  // 폐허(680, 400) 동쪽으로 산기슭(880)→협곡(1080)→운향(1280) 추가로 width 800→1400 확장.
  // 기존 region 좌표는 그대로 유지.
  viewBox: { width: 1400, height: 500 },
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
      id: "deep_cave",
      name: "깊은 동굴",
      description:
        "동굴 안쪽으로 파고들면 광맥이 두꺼워지고 공기가 차가워진다. 무언가 광물을 두른 것이 잠들어 있다.",
      position: { x: 140, y: 130 },
      biome: "cave",
      enemies: ["박쥐", "동굴뱀", "작은 광물 골렘"],
      encounterWeights: {
        박쥐: 35,
        동굴뱀: 35,
        "작은 광물 골렘": 30,
      },
      boss: { monsterName: "광맥의 수호자", dailyEntryLimit: 3 },
      recommendedLevel: 6,
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
      enemies: ["부서진 골렘", "떠도는 망령", "폐허 늑대"],
      encounterWeights: {
        "폐허 늑대": 40,
        "떠도는 망령": 40,
        "부서진 골렘": 20,
      },
      recommendedLevel: 9,
    },
    {
      id: "highland",
      name: "북풍 산기슭",
      description:
        "폐허 동쪽으로 솟은 비탈. 바람이 거칠고 돌투성이라 발 디딜 곳을 골라야 한다.",
      position: { x: 880, y: 380 },
      biome: "mountain",
      enemies: ["산양", "바위 두꺼비"],
      encounterWeights: { 산양: 60, "바위 두꺼비": 40 },
      recommendedLevel: 18,
    },
    {
      id: "canyon",
      name: "운무 협곡",
      description:
        "구름이 낮게 깔리는 좁은 협곡. 발소리가 메아리치고, 무언가 거대한 것이 안쪽을 막고 있다.",
      position: { x: 1080, y: 320 },
      biome: "mountain",
      enemies: ["절벽 늑대", "돌풍 정령", "늑대 무리장"],
      encounterWeights: {
        "절벽 늑대": 50,
        "돌풍 정령": 35,
        "늑대 무리장": 15,
      },
      recommendedLevel: 20,
    },
    {
      id: "unhyang",
      name: "운향",
      description:
        "구름이 발치에 깔리는 산정의 작은 도시. 산악을 피해 모인 장인과 순례자들이 산다.",
      position: { x: 1280, y: 260 },
      biome: "village",
      enemies: [],
      tags: ["town"],
      recommendedLevel: 22,
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
      from: "cave",
      to: "deep_cave",
      requires: {
        kind: "story",
        flagId: "jimmy_deep_cave_quest",
        reason: "나무꾼 지미가 동굴 안쪽에서 본 무언가에 대해 들려주지 않았다.",
      },
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
      requires: {
        kind: "story",
        flagId: "stranger_ruins_guide",
        reason: "아직 길을 알지 못한다. 디올라의 후드 쓴 손님이 안다고 한다.",
      },
    },
    // 운향 라인 (highland → canyon → unhyang).
    {
      from: "ruins",
      to: "highland",
      requires: { kind: "trial", battles: 5, enemiesFrom: "highland" },
    },
    {
      from: "highland",
      to: "canyon",
      requires: { kind: "trial", battles: 5, enemiesFrom: "canyon" },
    },
    // 운봉의 거인 (보스) 처치 시 set 되는 storyFlag. 보스 미구현이라 사실상 잠금 상태.
    {
      from: "canyon",
      to: "unhyang",
      requires: {
        kind: "story",
        flagId: "peak_giant_defeated",
        reason: "운봉의 거인이 길목을 가로막아 더 갈 수 없다.",
      },
    },
  ],
};

export const START_REGION_ID: RegionId = "village";

// 가중치 기반 등장 적 추첨. encounterWeights 미지정 시 균등 분포로 폴백.
export function pickEnemyName(
  region: Region,
  rng: () => number = Math.random,
): string | null {
  if (region.enemies.length === 0) return null;
  const weights = region.enemies.map(
    (name) => Math.max(0, region.encounterWeights?.[name] ?? 1),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return region.enemies[0];
  let roll = rng() * total;
  for (let i = 0; i < region.enemies.length; i += 1) {
    roll -= weights[i];
    if (roll < 0) return region.enemies[i];
  }
  return region.enemies[region.enemies.length - 1];
}

export function getAdjacent(map: WorldMap, regionId: RegionId): RegionId[] {
  const adjacent = new Set<RegionId>();
  for (const edge of map.edges) {
    if (edge.from === regionId) adjacent.add(edge.to);
    if (edge.to === regionId) adjacent.add(edge.from);
  }
  return Array.from(adjacent);
}
