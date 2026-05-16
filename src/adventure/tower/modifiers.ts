// 고탑 주간 모디파이어 — 매주 (KST 월 00:00 경계) 풀에서 1개 선택.
// 풀은 deterministic — 주차 키 (kstWeekStartKey) 의 epoch 일수 / 7 인덱스로 % len.
// effect 는 passive 배수만 (engine 변경 X) — scaledStats 에서 곱해 mob/보스 stat 에 반영.
//
// "보스만 등장" / "포션 -1" 같은 룰-변형은 v2 — 현재는 builds variety 와 가벼운 컨텐츠 유지가 목표.

import { kstWeekStartKey } from "./weeklyTypes";

export type TowerModifierId =
  | "none"
  | "stormy"
  | "heavy"
  | "sharp"
  | "iron"
  | "capricious";

export type TowerModifier = {
  id: TowerModifierId;
  /** UI pill 에 표시. */
  name: string;
  /** 한 줄 설명. */
  description: string;
  /** 적 HP 배수. 미지정 ↔ 1. */
  enemyHpMult?: number;
  /** 적 ATK 배수. */
  enemyAtkMult?: number;
  /** 적 DEF 배수. */
  enemyDefMult?: number;
  /** 적 SPD 배수 — 스케일링과 별개로 모디파이어 한정 곱연산. */
  enemySpdMult?: number;
};

/** 주간 모디파이어 풀. 인덱스 = (week epoch days / 7) % POOL.length. */
export const TOWER_MODIFIER_POOL: TowerModifier[] = [
  {
    id: "stormy",
    name: "거센 폭풍",
    description: "적 SPD ×1.25 — 천칭/회피 빌드가 흔들리는 한 주.",
    enemySpdMult: 1.25,
  },
  {
    id: "heavy",
    name: "둔중한 기운",
    description: "적 HP ×1.25 — 장기전을 견딜 자원이 빛나는 한 주.",
    enemyHpMult: 1.25,
  },
  {
    id: "sharp",
    name: "날카로운 결",
    description: "적 ATK ×1.15 — 한 방의 무게가 무거워지는 한 주.",
    enemyAtkMult: 1.15,
  },
  {
    id: "iron",
    name: "단단한 갑주",
    description: "적 DEF ×1.25 — DEF 무시 수단(천살·약점 노출 등) 이 값진 한 주.",
    enemyDefMult: 1.25,
  },
  {
    id: "capricious",
    name: "변덕스러운 운명",
    description: "적 모든 스탯 ×1.10 — 어떤 빌드든 약간 빡세지는 한 주.",
    enemyHpMult: 1.1,
    enemyAtkMult: 1.1,
    enemyDefMult: 1.1,
    enemySpdMult: 1.1,
  },
];

/** "none" 모디파이어 — 풀 외부에서 강제 노옵이 필요할 때 (테스트 등). */
export const TOWER_MODIFIER_NONE: TowerModifier = {
  id: "none",
  name: "평주",
  description: "모디파이어 없음.",
};

/**
 * 주차 인덱스 — kstWeekStartKey("YYYY-MM-DD") 를 epoch ms 로 변환한 후 7일로 나눈 정수.
 * 풀 길이로 % 해서 deterministic 선택.
 */
export function towerWeekIndex(now: Date = new Date()): number {
  const weekKey = kstWeekStartKey(now);
  const monday = new Date(weekKey + "T00:00:00Z").getTime();
  return Math.floor(monday / (7 * 24 * 60 * 60 * 1000));
}

/** 현재 주차의 모디파이어 — deterministic. */
export function currentWeeklyModifier(now: Date = new Date()): TowerModifier {
  const idx = towerWeekIndex(now);
  const len = TOWER_MODIFIER_POOL.length;
  // mod 음수 처리 — 1970-01 이전이면 양수로 정규화.
  const safeIdx = ((idx % len) + len) % len;
  return TOWER_MODIFIER_POOL[safeIdx];
}

/** id 로 룩업 — 클라/서버 동기화 검증용. */
export function getTowerModifier(id: TowerModifierId): TowerModifier {
  if (id === "none") return TOWER_MODIFIER_NONE;
  const found = TOWER_MODIFIER_POOL.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown TowerModifierId: ${id}`);
  return found;
}
