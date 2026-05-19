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

// 단일 progress 호출의 cap — 비정상 호출(어뷰즈) 차단.
// 주간 카운트 ×10 (보스 ×3) 으로 확대됨에 따라 cap 도 같이 키움.
export const QUEST_PROGRESS_CAP_PER_CALL = 200;

// 누적 명성 → 등급 산출.
export function gradeForFame(fameTotal: number): GuildGrade {
  // 위에서부터 순회 (S → G). 처음 임계 이상인 등급 반환.
  for (let i = GUILD_GRADE_ORDER.length - 1; i >= 0; i--) {
    const g = GUILD_GRADE_ORDER[i];
    if (fameTotal >= GUILD_GRADE_THRESHOLDS[g]) return g;
  }
  return "G";
}

// 길드 등급 → 출제 풀로 쓸 등급 목록.
// 2026-05-19: 풀 슬라이딩 윈도우 폐지. 해당 등급의 의뢰만 보이도록 자기 등급 단독.
// 각 등급에 6 종 이상 의뢰가 있으므로 3 개 주간 추첨 풀로 충분.
export function poolGradesFor(myGrade: GuildGrade): GuildGrade[] {
  return [myGrade];
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

// 주간 의뢰 풀 — 등급당 6 의뢰. 매주 cron 이 같은 등급 풀에서 3 개를 무작위 추첨.
// 2026-05-19 개편:
//  - 각 등급 의뢰 종류 2-3 → 6 종으로 확장 (잡몹 다양화 + 일부 보스).
//  - 카운트: 잡몹 ×10, 보스 ×3 (주간 의뢰 규모로 확대).
//  - 보상도 같은 배수로 (잡몹 ×10, 보스 ×3).
//  - 풀 슬라이딩 윈도우 폐지 — 자기 등급 의뢰만 노출.
export const GUILD_QUESTS: GuildQuestDef[] = [
  // ── G 등급 (시작, 마을 주변 잡몹) ───────────────────────────────────────
  {
    id: "g_slime_hunt",
    name: "슬라임 사냥",
    description: "마을 주변 슬라임 무리를 정리한다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "슬라임", count: 3000 },
    reward: {
      fame: 900,
      goldPerMember: 3000,
      materialsPerMember: [{ materialId: "slime_chunk", count: 50 }],
    },
  },
  {
    id: "g_drunkard_cleanup",
    name: "주정뱅이 정리",
    description: "광장 주정뱅이 소동을 마무리한다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "주정뱅이", count: 1800 },
    reward: {
      fame: 900,
      goldPerMember: 3000,
      materialsPerMember: [{ materialId: "rusty_nail", count: 50 }],
    },
  },
  {
    id: "g_wilddog_patrol",
    name: "들개 토벌",
    description: "마을 외곽 들개 무리를 토벌한다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "들개", count: 2400 },
    reward: {
      fame: 1100,
      goldPerMember: 3750,
      materialsPerMember: [{ materialId: "wilddog_hide", count: 30 }],
    },
  },
  {
    id: "g_mole_thin",
    name: "두더지 솎기",
    description: "평원에 굴을 들쑤시는 두더지를 솎아 경작지를 지킨다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "두더지", count: 2400 },
    reward: {
      fame: 1000,
      goldPerMember: 3500,
    },
  },
  {
    id: "g_cave_bat",
    name: "동굴 박쥐 정리",
    description: "깊은 동굴 입구에 들끓는 박쥐를 정리해 행상 통로를 연다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "박쥐", count: 1500 },
    reward: {
      fame: 1100,
      goldPerMember: 3600,
      materialsPerMember: [{ materialId: "bat_eye", count: 30 }],
    },
  },
  {
    id: "g_cave_snake",
    name: "동굴뱀 소탕",
    description: "광맥 가는 길에 자리잡은 동굴뱀 떼를 솎는다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "동굴뱀", count: 1500 },
    reward: {
      fame: 1100,
      goldPerMember: 3600,
      materialsPerMember: [{ materialId: "hard_crystal", count: 30 }],
    },
  },

  // ── F 등급 (숲/호수/폐허/마른나루 입구) ─────────────────────────────────
  {
    id: "f_tideflats_crabs",
    name: "갯벌 정리: 집게발 게",
    description: "디올라 남쪽 조수 갯벌에 들끓는 집게발 게를 솎아 길을 튼다.",
    grade: "F",
    task: { kind: "kill_monster", monsterName: "집게발 게", count: 4000 },
    reward: {
      fame: 1500,
      goldPerMember: 5400,
      materialsPerMember: [{ materialId: "crab_shell", count: 40 }],
    },
  },
  {
    id: "f_westgate_bandits",
    name: "옛길 정리: 노상강도",
    description: "시작 마을 서쪽 옛길에 눌러앉은 노상강도를 솎아 행상 길을 튼다.",
    grade: "F",
    task: { kind: "kill_monster", monsterName: "노상강도", count: 4000 },
    reward: {
      fame: 1400,
      goldPerMember: 5100,
      materialsPerMember: [{ materialId: "scrap_iron", count: 40 }],
    },
  },
  {
    id: "f_forest_spiders",
    name: "숲 거미 정리",
    description: "숲길 거미줄을 걷어 순례자 통로를 다시 연다.",
    grade: "F",
    task: { kind: "kill_monster", monsterName: "거미", count: 3000 },
    reward: {
      fame: 1500,
      goldPerMember: 5400,
      materialsPerMember: [{ materialId: "spider_silk", count: 30 }],
    },
  },
  {
    id: "f_lake_nymphs",
    name: "호수 님프 정리",
    description: "호수에 노래를 흘리는 님프를 솎아 낚시터를 다시 잠재운다.",
    grade: "F",
    task: { kind: "kill_monster", monsterName: "호수 님프", count: 3000 },
    reward: {
      fame: 1500,
      goldPerMember: 5400,
      materialsPerMember: [{ materialId: "fairy_dust", count: 30 }],
    },
  },
  {
    id: "f_ruins_specters",
    name: "폐허 망령 정화",
    description: "폐허에 떠도는 망령을 정화해 옛 길의 정적을 돌려놓는다.",
    grade: "F",
    task: { kind: "kill_monster", monsterName: "떠도는 망령", count: 2500 },
    reward: {
      fame: 1400,
      goldPerMember: 5100,
      materialsPerMember: [{ materialId: "soul_crystal", count: 30 }],
    },
  },
  {
    id: "f_ruins_golems",
    name: "부서진 골렘 정리",
    description: "폐허에 멈춰 선 부서진 골렘을 분해해 통로를 다시 튼다.",
    grade: "F",
    task: { kind: "kill_monster", monsterName: "부서진 골렘", count: 2500 },
    reward: {
      fame: 1400,
      goldPerMember: 5100,
      materialsPerMember: [{ materialId: "ruin_fragment", count: 30 }],
    },
  },

  // ── E 등급 (소만/마른나루 보스 + 갈대밭/암초) ──────────────────────────
  {
    id: "e_deep_one_pacify",
    name: "수심의 것 가라앉히기",
    description: "산호초 섬 암초 밑에서 뒤척이는 수심의 것을 거듭 가라앉혀 소만 뱃길을 지킨다.",
    grade: "E",
    task: { kind: "kill_boss", monsterName: "수심의 것", count: 24 },
    reward: {
      fame: 840,
      goldPerMember: 3600,
      materialsPerMember: [{ materialId: "deep_scale", count: 9 }],
    },
  },
  {
    id: "e_gatekeeper_decommission",
    name: "옛 성문지기 잠재우기",
    description: "옛 변경 성채 성문을 지키는 옛 성문지기를 거듭 잠재워 마른나루 옛길을 지킨다.",
    grade: "E",
    task: { kind: "kill_boss", monsterName: "옛 성문지기", count: 24 },
    reward: {
      fame: 810,
      goldPerMember: 3450,
      materialsPerMember: [{ materialId: "scrap_iron", count: 9 }],
    },
  },
  {
    id: "e_saltmarsh_mudfish",
    name: "갯벌 미꾸라지 솎기",
    description: "소만 갯벌 곳곳에 풀어진 진흙 미꾸라지를 솎아 통발 길을 잡는다.",
    grade: "E",
    task: { kind: "kill_monster", monsterName: "진흙 미꾸라지", count: 4000 },
    reward: {
      fame: 2200,
      goldPerMember: 8000,
      materialsPerMember: [{ materialId: "scrap_iron", count: 30 }],
    },
  },
  {
    id: "e_reef_siren",
    name: "산호초 사이렌 솎기",
    description: "산호초 섬 안개에서 노래를 흘리는 사이렌을 솎아 뱃삯을 안정시킨다.",
    grade: "E",
    task: { kind: "kill_monster", monsterName: "산호초 사이렌", count: 3500 },
    reward: {
      fame: 2300,
      goldPerMember: 8500,
      materialsPerMember: [{ materialId: "coral_spine", count: 30 }],
    },
  },
  {
    id: "e_reef_carapace",
    name: "갑각 약탈자 정리",
    description: "산호초 섬 갯바위에 들끓는 갑각 약탈자를 솎아 어부의 길을 튼다.",
    grade: "E",
    task: { kind: "kill_monster", monsterName: "갑각 약탈자", count: 3500 },
    reward: {
      fame: 2300,
      goldPerMember: 8500,
      materialsPerMember: [{ materialId: "deep_scale", count: 25 }],
    },
  },
  {
    id: "e_oldwall_crow",
    name: "폐성벽 까마귀 떼 정리",
    description: "옛 변경 성채 폐성벽에 깃을 떨구는 까마귀 떼를 정리해 행상 시야를 튼다.",
    grade: "E",
    task: { kind: "kill_monster", monsterName: "폐성벽 까마귀", count: 4000 },
    reward: {
      fame: 2200,
      goldPerMember: 8000,
      materialsPerMember: [{ materialId: "raven_feather", count: 30 }],
    },
  },

  // ── D 등급 (운향 라인) ───────────────────────────────────────────────
  {
    id: "d_cloud_plain_bison",
    name: "운저 평원 들소 토벌",
    description: "운저 평원을 가로지르는 들소 무리를 정리해 역참 행상길의 통행을 안정시킨다.",
    grade: "D",
    task: { kind: "kill_monster", monsterName: "들소", count: 6000 },
    reward: {
      fame: 5000,
      goldPerMember: 21000,
      materialsPerMember: [{ materialId: "bison_hide", count: 50 }],
    },
  },
  {
    id: "d_ashen_pass_dog",
    name: "잿빛 협로 들개 솎기",
    description: "잿빛 협로에 들끓는 잿빛 들개를 솎아 짐꾼의 길을 튼다.",
    grade: "D",
    task: { kind: "kill_monster", monsterName: "잿빛 들개", count: 6000 },
    reward: {
      fame: 5000,
      goldPerMember: 21000,
      materialsPerMember: [{ materialId: "ash_stone", count: 40 }],
    },
  },
  {
    id: "d_canyon_giant_boss",
    name: "운봉의 거인 토벌",
    description: "운무 협곡 깊은 자리에 다시 깨어나는 운봉의 거인을 거듭 잠재워 산정의 명운을 지킨다.",
    grade: "D",
    task: { kind: "kill_boss", monsterName: "운봉의 거인", count: 9 },
    reward: {
      fame: 4500,
      goldPerMember: 18000,
      materialsPerMember: [
        { materialId: "giant_scale", count: 6 },
        { materialId: "unbong_ore", count: 3 },
      ],
    },
  },
  {
    id: "d_plains_hawk",
    name: "운저 평원 초원 매 정리",
    description: "운저 평원 능선을 맴도는 초원 매를 솎아 짐꾼의 머리 위를 비운다.",
    grade: "D",
    task: { kind: "kill_monster", monsterName: "초원 매", count: 5000 },
    reward: {
      fame: 4800,
      goldPerMember: 19000,
      materialsPerMember: [{ materialId: "hawk_feather", count: 40 }],
    },
  },
  {
    id: "d_marauder",
    name: "떠돌이 약탈자 솎기",
    description: "잿빛 협로 변두리에 자리잡은 떠돌이 약탈자를 솎아 짐꾼의 길을 안정시킨다.",
    grade: "D",
    task: { kind: "kill_monster", monsterName: "떠돌이 약탈자", count: 5000 },
    reward: {
      fame: 4800,
      goldPerMember: 19000,
      materialsPerMember: [{ materialId: "scrap_iron", count: 40 }],
    },
  },
  {
    id: "d_ash_golem",
    name: "재먼지 골렘 분해",
    description: "잿빛 협로에 멈춰 선 재먼지 골렘을 분해해 행상 통로를 다시 튼다.",
    grade: "D",
    task: { kind: "kill_monster", monsterName: "재먼지 골렘", count: 4500 },
    reward: {
      fame: 4900,
      goldPerMember: 19500,
      materialsPerMember: [{ materialId: "ash_stone", count: 35 }],
    },
  },

  // ── C 등급 (봉황령/뼈무덤) ───────────────────────────────────────────
  {
    id: "c_phoenix_ridge_lizard",
    name: "봉황령 화염 도마뱀 솎기",
    description: "봉황령 능선에서 둥지를 트는 화염 도마뱀을 솎아 산악길을 지킨다.",
    grade: "C",
    task: { kind: "kill_monster", monsterName: "화염 도마뱀", count: 6000 },
    reward: {
      fame: 9000,
      goldPerMember: 38000,
      materialsPerMember: [{ materialId: "flame_scale", count: 40 }],
    },
  },
  {
    id: "c_bone_marches_hyena",
    name: "뼈무덤 황야 하이에나 정리",
    description: "뼈무덤 황야에 출몰하는 역병 하이에나를 정리해 묘지 접근로를 청소한다.",
    grade: "C",
    task: { kind: "kill_monster", monsterName: "역병 하이에나", count: 6000 },
    reward: {
      fame: 9000,
      goldPerMember: 38000,
      materialsPerMember: [{ materialId: "scale_dust", count: 40 }],
    },
  },
  {
    id: "c_phoenix_eagle",
    name: "봉황령 불꽃 독수리 토벌",
    description: "봉황령 정상을 도는 불꽃 독수리를 잡아 둥지를 흩는다.",
    grade: "C",
    task: { kind: "kill_monster", monsterName: "불꽃 독수리", count: 5000 },
    reward: {
      fame: 8500,
      goldPerMember: 36000,
      materialsPerMember: [{ materialId: "phoenix_feather", count: 30 }],
    },
  },
  {
    id: "c_mountain_knight",
    name: "봉황령 산악 기사 진압",
    description: "능선을 막아선 산악 기사 잔당을 진압해 봉황령 통행을 연다.",
    grade: "C",
    task: { kind: "kill_monster", monsterName: "산악 기사", count: 4500 },
    reward: {
      fame: 8500,
      goldPerMember: 36000,
      materialsPerMember: [{ materialId: "wind_mana_stone", count: 25 }],
    },
  },
  {
    id: "c_gravekeeper_gremlin",
    name: "뼈무덤 묘지 그렘린 솎기",
    description: "뼈무덤 묘지 사이를 휘젓는 묘지 그렘린을 솎아 봉인 작업을 돕는다.",
    grade: "C",
    task: { kind: "kill_monster", monsterName: "묘지 그렘린", count: 5000 },
    reward: {
      fame: 8500,
      goldPerMember: 36000,
      materialsPerMember: [{ materialId: "scale_dust", count: 35 }],
    },
  },
  {
    id: "c_fallen_knight",
    name: "타락한 묘지기사 정화",
    description: "뼈무덤 안쪽에 다시 일어선 타락한 묘지기사를 정화해 봉인 작업을 보전한다.",
    grade: "C",
    task: { kind: "kill_monster", monsterName: "타락한 묘지기사", count: 4500 },
    reward: {
      fame: 8500,
      goldPerMember: 36000,
      materialsPerMember: [{ materialId: "raven_feather", count: 30 }],
    },
  },

  // ── B 등급 (화산/별의 첨탑 도입) ─────────────────────────────────────
  {
    id: "b_volcanic_slime",
    name: "화산 지대 용암 슬라임 정리",
    description: "화산 지대 분기공에서 끓어오르는 용암 슬라임을 솎아 채광로를 연다.",
    grade: "B",
    task: { kind: "kill_monster", monsterName: "용암 슬라임", count: 5000 },
    reward: {
      fame: 16000,
      goldPerMember: 68000,
      materialsPerMember: [{ materialId: "lava_core", count: 30 }],
    },
  },
  {
    id: "b_volcanic_heart_boss",
    name: "화산의 심장 가라앉히기",
    description: "화산 지대 심부에서 거듭 깨어나는 화산의 심장을 가라앉혀 인근 마을의 진동을 진정시킨다.",
    grade: "B",
    task: { kind: "kill_boss", monsterName: "화산의 심장", count: 15 },
    reward: {
      fame: 4800,
      goldPerMember: 20400,
      materialsPerMember: [
        { materialId: "lava_core", count: 9 },
        { materialId: "mana_crystal", count: 3 },
      ],
    },
  },
  {
    id: "b_starkeeper_boss",
    name: "별을 지키는 자 토벌",
    description: "별의 첨탑 정상에 다시 깨어나는 별을 지키는 자를 거듭 잠재워 첨탑의 빛을 보전한다.",
    grade: "B",
    task: { kind: "kill_boss", monsterName: "별을 지키는 자", count: 9 },
    reward: {
      fame: 4500,
      goldPerMember: 19000,
      materialsPerMember: [
        { materialId: "stardust", count: 6 },
        { materialId: "stellar_essence", count: 3 },
      ],
    },
  },
  {
    id: "b_stargazer_specter",
    name: "별점술사 잔영 정화",
    description: "별의 첨탑 회랑에 떠도는 별점술사 잔영을 정화해 첨탑의 별빛을 다시 맑게 한다.",
    grade: "B",
    task: { kind: "kill_monster", monsterName: "별점술사 잔영", count: 4500 },
    reward: {
      fame: 15500,
      goldPerMember: 65000,
      materialsPerMember: [{ materialId: "stardust", count: 30 }],
    },
  },
  {
    id: "b_cloud_hunter",
    name: "구름 사냥꾼 솎기",
    description: "첨탑 외벽을 떠도는 구름 사냥꾼을 솎아 정상 회랑을 안정시킨다.",
    grade: "B",
    task: { kind: "kill_monster", monsterName: "구름 사냥꾼", count: 4500 },
    reward: {
      fame: 15500,
      goldPerMember: 65000,
      materialsPerMember: [{ materialId: "sky_alloy", count: 25 }],
    },
  },
  {
    id: "b_fate_weaver",
    name: "운명 직조자 정리",
    description: "별의 첨탑 안쪽에 자리잡은 운명 직조자를 정리해 첨탑의 회로를 풀어낸다.",
    grade: "B",
    task: { kind: "kill_monster", monsterName: "운명 직조자", count: 4500 },
    reward: {
      fame: 15500,
      goldPerMember: 65000,
      materialsPerMember: [{ materialId: "stellar_essence", count: 25 }],
    },
  },

  // ── A 등급 (별빛 회랑/폐도/용비늘 묘지) ──────────────────────────────
  {
    id: "a_corridor_specter",
    name: "별빛 회랑 망령 정화",
    description: "별빛 회랑 사이에 떠도는 별빛 망령을 정화해 회랑 안의 별빛을 다시 맑게 한다.",
    grade: "A",
    task: { kind: "kill_monster", monsterName: "별빛 망령", count: 5000 },
    reward: {
      fame: 29000,
      goldPerMember: 120000,
      materialsPerMember: [{ materialId: "corridor_relic", count: 30 }],
    },
  },
  {
    id: "a_dragon_lich_boss",
    name: "뼈비늘 노룡 토벌",
    description: "용비늘 묘지 심부에서 잿빛 비늘을 곤두세우는 뼈비늘 노룡을 거듭 토벌한다.",
    grade: "A",
    task: { kind: "kill_boss", monsterName: "뼈비늘 노룡", count: 9 },
    reward: {
      fame: 8700,
      goldPerMember: 36000,
      materialsPerMember: [
        { materialId: "dragonscale_shard", count: 6 },
        { materialId: "bone_rune_steel", count: 3 },
      ],
    },
  },
  {
    id: "a_skyfolk_king_boss",
    name: "천공인의 왕 토벌",
    description: "폐도 안쪽에 다시 일어선 천공인의 왕을 거듭 잠재워 옛 천공인의 결을 보전한다.",
    grade: "A",
    task: { kind: "kill_boss", monsterName: "천공인의 왕", count: 9 },
    reward: {
      fame: 8700,
      goldPerMember: 36000,
      materialsPerMember: [
        { materialId: "sky_alloy", count: 6 },
        { materialId: "corridor_relic", count: 3 },
      ],
    },
  },
  {
    id: "a_skyfolk_officer",
    name: "천공인 사관 솎기",
    description: "폐도 회랑을 지키는 천공인 사관을 솎아 회랑 통행을 안정시킨다.",
    grade: "A",
    task: { kind: "kill_monster", monsterName: "천공인 사관", count: 4500 },
    reward: {
      fame: 27000,
      goldPerMember: 110000,
      materialsPerMember: [{ materialId: "sky_alloy", count: 25 }],
    },
  },
  {
    id: "a_skyfolk_warrior",
    name: "천공인 전사 진압",
    description: "폐도 안쪽 광장에 자리잡은 천공인 전사들을 진압해 폐도 통행을 튼다.",
    grade: "A",
    task: { kind: "kill_monster", monsterName: "천공인 전사", count: 4500 },
    reward: {
      fame: 27000,
      goldPerMember: 110000,
      materialsPerMember: [{ materialId: "corridor_relic", count: 25 }],
    },
  },
  {
    id: "a_ruin_colossus",
    name: "폐허의 거상 분해",
    description: "폐도 안쪽에 멈춰 선 폐허의 거상을 분해해 폐도 통로를 다시 튼다.",
    grade: "A",
    task: { kind: "kill_monster", monsterName: "폐허의 거상", count: 4000 },
    reward: {
      fame: 28000,
      goldPerMember: 115000,
      materialsPerMember: [{ materialId: "ruin_fragment", count: 30 }],
    },
  },

  // ── S 등급 (옥좌의 길/창공의 옥좌/별빛 갱도) ─────────────────────────
  {
    id: "s_throne_road_seal",
    name: "옥좌의 길 봉인 파편 정화",
    description: "옥좌의 길을 떠도는 봉인 파편을 정화해 황성 통로를 다시 잠근다.",
    grade: "S",
    task: { kind: "kill_monster", monsterName: "봉인 파편", count: 4000 },
    reward: {
      fame: 52000,
      goldPerMember: 220000,
      materialsPerMember: [{ materialId: "empyrean_shard", count: 20 }],
    },
  },
  {
    id: "s_throne_warden",
    name: "황성 호위병 제압",
    description: "옥좌의 길을 가로막는 황성 호위병을 제압해 황성으로의 길을 연다.",
    grade: "S",
    task: { kind: "kill_monster", monsterName: "황성 호위병", count: 4000 },
    reward: {
      fame: 52000,
      goldPerMember: 220000,
      materialsPerMember: [
        { materialId: "road_relic", count: 20 },
        { materialId: "primordial_essence", count: 10 },
      ],
    },
  },
  {
    id: "s_apex_arbiter_boss",
    name: "창공의 주재 토벌",
    description: "창공의 옥좌에 다시 깨어나는 창공의 주재를 거듭 토벌해 옥좌의 정적을 지킨다.",
    grade: "S",
    task: { kind: "kill_boss", monsterName: "창공의 주재", count: 9 },
    reward: {
      fame: 15600,
      goldPerMember: 66000,
      materialsPerMember: [
        { materialId: "aether_alloy", count: 6 },
        { materialId: "primordial_essence", count: 3 },
      ],
    },
  },
  {
    id: "s_starfall_warden_boss",
    name: "별빛 광맥 수호자 토벌",
    description: "별빛 갱도 안쪽에 데워진 별빛 광맥 수호자를 거듭 잠재워 갱도의 별빛을 보전한다.",
    grade: "S",
    task: { kind: "kill_boss", monsterName: "별빛 광맥 수호자", count: 9 },
    reward: {
      fame: 15600,
      goldPerMember: 66000,
      materialsPerMember: [
        { materialId: "stellar_essence", count: 6 },
        { materialId: "empyrean_shard", count: 3 },
      ],
    },
  },
  {
    id: "s_apex_apostle",
    name: "별빛 사도 정화",
    description: "옥좌 둘레를 두르는 별빛 사도를 정화해 옥좌의 봉인을 다시 잡는다.",
    grade: "S",
    task: { kind: "kill_monster", monsterName: "별빛 사도", count: 3000 },
    reward: {
      fame: 48000,
      goldPerMember: 200000,
      materialsPerMember: [{ materialId: "road_relic", count: 15 }],
    },
  },
  {
    id: "s_throne_swordknight",
    name: "옥좌의 검신 진압",
    description: "옥좌 앞에 다시 선 옥좌의 검신을 진압해 옥좌의 결을 보전한다.",
    grade: "S",
    task: { kind: "kill_monster", monsterName: "옥좌의 검신", count: 3000 },
    reward: {
      fame: 48000,
      goldPerMember: 200000,
      materialsPerMember: [{ materialId: "aether_alloy", count: 15 }],
    },
  },
];

export function getGuildQuestById(id: string): GuildQuestDef | undefined {
  return GUILD_QUESTS.find((q) => q.id === id);
}
