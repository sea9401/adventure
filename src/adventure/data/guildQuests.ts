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
// 길드 의뢰 명성 보상을 ×3 한 데 맞춰 임계도 올렸으나, 같은 ×3 이 아니라 ×2 로만 —
// 등급 진행이 원래 페이스보다 1.5배쯤 빨라지도록 의도적으로 적게 보정한다.
export const GUILD_GRADE_THRESHOLDS: Record<GuildGrade, number> = {
  G: 0,
  F: 400,
  E: 1200,
  D: 3000,
  C: 7000,
  B: 16000,
  A: 36000,
  S: 80000,
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

// Phase A — G 등급 의뢰 3종. F 이상 풀은 Phase B 에서 발란스 후 추가.
// 3개 동시 진행 체제 — 재료 보상 없음, 골드 ×0.5, 명성 ×1.5.
export const GUILD_QUESTS: GuildQuestDef[] = [
  {
    id: "g_slime_hunt",
    name: "슬라임 사냥",
    description: "마을 주변 슬라임 무리를 정리한다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "슬라임", count: 300 },
    reward: { fame: 90, goldPerMember: 300 },
  },
  {
    id: "g_drunkard_cleanup",
    name: "주정뱅이 정리",
    description: "광장 주정뱅이 소동을 마무리한다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "주정뱅이", count: 180 },
    reward: { fame: 90, goldPerMember: 300 },
  },
  {
    id: "g_wilddog_patrol",
    name: "들개 토벌",
    description: "마을 외곽 들개 무리를 토벌한다.",
    grade: "G",
    task: { kind: "kill_monster", monsterName: "들개", count: 240 },
    reward: { fame: 110, goldPerMember: 375 },
  },
];

export function getGuildQuestById(id: string): GuildQuestDef | undefined {
  return GUILD_QUESTS.find((q) => q.id === id);
}

export function getGuildQuestsByGrades(grades: GuildGrade[]): GuildQuestDef[] {
  const set = new Set(grades);
  return GUILD_QUESTS.filter((q) => set.has(q.grade));
}
