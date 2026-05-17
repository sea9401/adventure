import type { ItemId } from "./items";
import type { MaterialId } from "./materials";

// 길드 등급 — 누적 명성에 따라 자동 결정. 알파벳 8단계 G(시작) → S(최고).
export type GuildGrade = "G" | "F" | "E" | "D" | "C" | "B" | "A" | "S";

export const GUILD_GRADE_ORDER: GuildGrade[] = [
  "G",
  "F",
  "E",
  "D",
  "C",
  "B",
  "A",
  "S",
];

// 누적 명성 임계 — 이 값 이상이면 해당 등급. 검색은 위→아래 순회.
// 길드 의뢰 명성 보상을 ×3 한 데 맞춰 임계도 ×3 으로 맞춰 원래 페이스에 근사하게 — 보정 제거.
export const GUILD_GRADE_THRESHOLDS: Record<GuildGrade, number> = {
  G: 0,
  F: 600,
  E: 1800,
  D: 4500,
  C: 10500,
  B: 24000,
  A: 54000,
  S: 120000,
};

// 슬라이딩 윈도우 ±N — 길드 등급 D 면 F~B 풀에서 추첨 (B 가 +2 위).
export const QUEST_POOL_WINDOW = 2;

// 단일 progress 호출의 cap — 비정상 호출(어뷰즈) 차단.
export const QUEST_PROGRESS_CAP_PER_CALL = 50;

// 누적 명성 → 등급 산출.
export function gradeForFame(fameTotal: number): GuildGrade {
  // 위에서부터 순회 (S → G). 처음 임계 이상인 등급 반환.
  for (let i = GUILD_GRADE_ORDER.length - 1; i >= 0; i--) {
    const g = GUILD_GRADE_ORDER[i];
    if (fameTotal >= GUILD_GRADE_THRESHOLDS[g]) return g;
  }
  return "G";
}

// 길드 등급 → 슬라이딩 윈도우 ±2 안의 등급 목록.
// G 시작은 G 풀, S 끝은 자기 등급만 (위쪽 콘텐츠 추가되면 자동 확장).
export function poolGradesFor(myGrade: GuildGrade): GuildGrade[] {
  const idx = GUILD_GRADE_ORDER.indexOf(myGrade);
  const lo = Math.max(0, idx - QUEST_POOL_WINDOW);
  const hi = Math.min(GUILD_GRADE_ORDER.length - 1, idx + QUEST_POOL_WINDOW);
  return GUILD_GRADE_ORDER.slice(lo, hi + 1);
}

export type GuildQuestTask =
  | { kind: "kill_monster"; monsterName: string; count: number }
  | { kind: "kill_boss"; monsterName: string; count: number }
  | { kind: "collect_material"; materialId: MaterialId; count: number };

export type GuildQuestReward = {
  fame: number;
  goldPerMember: number;
  materialsPerMember?: { materialId: MaterialId; count: number }[];
  itemsPerMember?: { itemId: ItemId; count: number }[];
};

export type GuildQuestDef = {
  id: string;
  name: string;
  description: string;
  grade: GuildGrade;
  task: GuildQuestTask;
  reward: GuildQuestReward;
};

// Phase B — G~S 전 등급 풀.
// 3개 동시 진행 체제 — kill_monster 도 지역 재료 소량 지급(원본 카운트의 ~1/3).
// 보상 곡선: 등급당 fame/gold ≈ ×1.8 (G→F→E 비율 유지). kill_boss 는 솔로 보스만.
export const GUILD_QUESTS: GuildQuestDef[] = [
  {
    id: "g_slime_hunt",
    name: "슬라임 사냥",
    description: "마을 주변 슬라임 무리를 정리한다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "슬라임", count: 300 },
    reward: {
      fame: 90,
      goldPerMember: 300,
      materialsPerMember: [{ materialId: "slime_chunk", count: 5 }],
    },
  },
  {
    id: "g_drunkard_cleanup",
    name: "주정뱅이 정리",
    description: "광장 주정뱅이 소동을 마무리한다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "주정뱅이", count: 180 },
    reward: {
      fame: 90,
      goldPerMember: 300,
      materialsPerMember: [{ materialId: "rusty_nail", count: 5 }],
    },
  },
  {
    id: "g_wilddog_patrol",
    name: "들개 토벌",
    description: "마을 외곽 들개 무리를 토벌한다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "들개", count: 240 },
    reward: {
      fame: 110,
      goldPerMember: 375,
      materialsPerMember: [{ materialId: "wilddog_hide", count: 3 }],
    },
  },
  {
    id: "f_tideflats_crabs",
    name: "갯벌 정리 — 집게발 게",
    description: "디올라 남쪽 조수 갯벌에 들끓는 집게발 게를 솎아 길을 튼다.",
    grade: "F",
    task: { kind: "kill_monster", monsterName: "집게발 게", count: 400 },
    reward: {
      fame: 150,
      goldPerMember: 540,
      materialsPerMember: [{ materialId: "crab_shell", count: 4 }],
    },
  },
  {
    id: "e_deep_one_pacify",
    name: "수심의 것 가라앉히기",
    description: "산호초 섬 암초 밑에서 뒤척이는 수심의 것을 거듭 가라앉혀 소만 뱃길을 지킨다.",
    grade: "E",
    task: { kind: "kill_boss", monsterName: "수심의 것", count: 8 },
    reward: {
      fame: 280,
      goldPerMember: 1200,
      materialsPerMember: [{ materialId: "deep_scale", count: 3 }],
    },
  },
  {
    id: "f_westgate_bandits",
    name: "옛길 정리 — 노상강도",
    description: "시작 마을 서쪽 옛길에 눌러앉은 노상강도를 솎아 행상 길을 튼다.",
    grade: "F",
    task: { kind: "kill_monster", monsterName: "노상강도", count: 400 },
    reward: {
      fame: 140,
      goldPerMember: 510,
      materialsPerMember: [{ materialId: "scrap_iron", count: 4 }],
    },
  },
  {
    id: "e_gatekeeper_decommission",
    name: "옛 성문지기 잠재우기",
    description: "옛 변경 성채 성문을 지키는 옛 성문지기를 거듭 잠재워 마른나루 옛길을 지킨다.",
    grade: "E",
    task: { kind: "kill_boss", monsterName: "옛 성문지기", count: 8 },
    reward: {
      fame: 270,
      goldPerMember: 1150,
      materialsPerMember: [{ materialId: "scrap_iron", count: 3 }],
    },
  },
  {
    id: "d_cloud_plain_bison",
    name: "운저 평원 들소 토벌",
    description: "운저 평원을 가로지르는 들소 무리를 정리해 역참 행상길의 통행을 안정시킨다.",
    grade: "D",
    task: { kind: "kill_monster", monsterName: "들소", count: 600 },
    reward: {
      fame: 500,
      goldPerMember: 2100,
      materialsPerMember: [{ materialId: "bison_hide", count: 5 }],
    },
  },
  {
    id: "d_ashen_pass_dog",
    name: "잿빛 협로 들개 솎기",
    description: "잿빛 협로에 들끓는 잿빛 들개를 솎아 짐꾼의 길을 튼다.",
    grade: "D",
    task: { kind: "kill_monster", monsterName: "잿빛 들개", count: 600 },
    reward: {
      fame: 500,
      goldPerMember: 2100,
      materialsPerMember: [{ materialId: "ash_stone", count: 4 }],
    },
  },
  {
    id: "c_phoenix_ridge_lizard",
    name: "봉황령 화염 도마뱀 솎기",
    description: "봉황령 능선에서 둥지를 트는 화염 도마뱀을 솎아 산악길을 지킨다.",
    grade: "C",
    task: { kind: "kill_monster", monsterName: "화염 도마뱀", count: 600 },
    reward: {
      fame: 900,
      goldPerMember: 3800,
      materialsPerMember: [{ materialId: "flame_scale", count: 4 }],
    },
  },
  {
    id: "c_bone_marches_hyena",
    name: "뼈무덤 황야 하이에나 정리",
    description: "뼈무덤 황야에 출몰하는 역병 하이에나를 정리해 묘지 접근로를 청소한다.",
    grade: "C",
    task: { kind: "kill_monster", monsterName: "역병 하이에나", count: 600 },
    reward: {
      fame: 900,
      goldPerMember: 3800,
      materialsPerMember: [{ materialId: "scale_dust", count: 4 }],
    },
  },
  {
    id: "b_volcanic_slime",
    name: "화산 지대 용암 슬라임 정리",
    description: "화산 지대 분기공에서 끓어오르는 용암 슬라임을 솎아 채광로를 연다.",
    grade: "B",
    task: { kind: "kill_monster", monsterName: "용암 슬라임", count: 500 },
    reward: {
      fame: 1600,
      goldPerMember: 6800,
      materialsPerMember: [{ materialId: "lava_core", count: 3 }],
    },
  },
  {
    id: "b_volcanic_heart_boss",
    name: "화산의 심장 가라앉히기",
    description: "화산 지대 심부에서 거듭 깨어나는 화산의 심장을 가라앉혀 인근 마을의 진동을 진정시킨다.",
    grade: "B",
    task: { kind: "kill_boss", monsterName: "화산의 심장", count: 5 },
    reward: {
      fame: 1600,
      goldPerMember: 6800,
      materialsPerMember: [
        { materialId: "lava_core", count: 3 },
        { materialId: "mana_crystal", count: 1 },
      ],
    },
  },
  {
    id: "a_corridor_specter",
    name: "별빛 회랑 망령 정화",
    description: "별빛 회랑 사이에 떠도는 별빛 망령을 정화해 회랑 안의 별빛을 다시 맑게 한다.",
    grade: "A",
    task: { kind: "kill_monster", monsterName: "별빛 망령", count: 500 },
    reward: {
      fame: 2900,
      goldPerMember: 12000,
      materialsPerMember: [{ materialId: "corridor_relic", count: 3 }],
    },
  },
  {
    id: "a_dragon_lich_boss",
    name: "뼈비늘 노룡 토벌",
    description: "용비늘 묘지 심부에서 잿빛 비늘을 곤두세우는 뼈비늘 노룡을 거듭 토벌한다.",
    grade: "A",
    task: { kind: "kill_boss", monsterName: "뼈비늘 노룡", count: 3 },
    reward: {
      fame: 2900,
      goldPerMember: 12000,
      materialsPerMember: [
        { materialId: "dragonscale_shard", count: 2 },
        { materialId: "bone_rune_steel", count: 1 },
      ],
    },
  },
  {
    id: "s_throne_road_seal",
    name: "옥좌의 길 봉인 파편 정화",
    description: "옥좌의 길을 떠도는 봉인 파편을 정화해 황성 통로를 다시 잠근다.",
    grade: "S",
    task: { kind: "kill_monster", monsterName: "봉인 파편", count: 400 },
    reward: {
      fame: 5200,
      goldPerMember: 22000,
      materialsPerMember: [{ materialId: "empyrean_shard", count: 2 }],
    },
  },
  {
    id: "s_throne_warden",
    name: "황성 호위병 제압",
    description: "옥좌의 길을 가로막는 황성 호위병을 제압해 황성으로의 길을 연다.",
    grade: "S",
    task: { kind: "kill_monster", monsterName: "황성 호위병", count: 400 },
    reward: {
      fame: 5200,
      goldPerMember: 22000,
      materialsPerMember: [
        { materialId: "road_relic", count: 2 },
        { materialId: "primordial_essence", count: 1 },
      ],
    },
  },
];

export function getGuildQuestById(id: string): GuildQuestDef | undefined {
  return GUILD_QUESTS.find((q) => q.id === id);
}
