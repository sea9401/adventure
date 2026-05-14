// 마을 모험가 길드 게시판 — 너무 많은 의뢰 카드가 한꺼번에 노출되지 않도록 매일 5개로 캡.
//
// 동작:
//  1) "데일리 풀" — 해당 지역의 kill 의뢰 중 선행 충족 + 비반복 완료가 아닌 것.
//     (비반복-완료/취소 카드는 더 이상 진행할 수 없으니 풀에서 제외.)
//  2) "오늘의 5개" — (날짜키 + regionId) 시드로 결정론적 셔플 후 슬라이스. 같은 날 다시
//     들어가도 같은 5개. 자정 넘어가면 다음 5개. 모든 플레이어가 같은 보드를 본다.
//  3) "보드 노출" — 오늘의 5개 + 그 5개에 안 든 active/ready 의뢰 (이미 수락/완료대기는
//     5개 캡과 무관하게 항상 보임).
//
// 페어 함수 getAcceptableQuestIds 가 같은 보드 안에서만 "전체 수락" 대상을 계산하므로
// 카운트와 실제 수락 결과가 일치한다.

import { getQuestsForRegion, type KillQuest } from "../data/quests";
import type { RegionId } from "../data/world";
import type { QuestProgressEntry } from "./storage";

export const BOARD_DAILY_LIMIT = 5;

// 클라이언트 로컬 자정 기준 'YYYY-MM-DD' (sv-SE 가 ISO-like 안전한 포맷).
export function boardDateKey(): string {
  return new Date().toLocaleDateString("sv-SE");
}

// FNV-1a 변형 해시 — string → 32bit seed. 충돌은 무해 (셔플 시드 용).
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — 32bit seed PRNG, 균일 분포 [0, 1).
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates with seeded RNG — 결정론적 셔플.
function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed));
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 풀: 지역의 kill 의뢰 중 선행 충족 + (비반복이면 아직 완료 안 한 것). 보드 5개 추첨 대상.
function getDailyPool(
  regionId: RegionId,
  getEntry: (id: string) => QuestProgressEntry,
): KillQuest[] {
  return getQuestsForRegion(regionId).filter((q) => {
    if (q.requiresQuestCompleted) {
      if (getEntry(q.requiresQuestCompleted).completedCount === 0) return false;
    }
    if (!q.repeatable && getEntry(q.id).completedCount > 0) return false;
    return true;
  });
}

// 오늘의 보드에 나올 의뢰 목록.
// - 오늘의 5개(셔플 슬라이스) + 그에 포함 안 된 active/ready 의뢰(항상 표시).
// - 비반복 완료 의뢰는 풀에서 빠져있어 보드에 안 나옴 (현재 데이터에 거의 없지만 의도된 동작).
export function getBoardQuestsForRegion(
  regionId: RegionId,
  getEntry: (id: string) => QuestProgressEntry,
  dateKey: string = boardDateKey(),
): KillQuest[] {
  const pool = getDailyPool(regionId, getEntry);
  const today = seededShuffle(pool, `${dateKey}:${regionId}`).slice(
    0,
    BOARD_DAILY_LIMIT,
  );
  const todayIds = new Set(today.map((q) => q.id));

  // 5개에 안 든 active/ready 도 같이 노출 — 이미 수락한 것은 5개 캡과 무관하게 항상 보임.
  // 선행 충족도 다시 확인 (extras 가 데일리 풀과 같은 prereq 검증을 거치도록).
  const extras = getQuestsForRegion(regionId).filter((q) => {
    if (todayIds.has(q.id)) return false;
    if (q.requiresQuestCompleted) {
      if (getEntry(q.requiresQuestCompleted).completedCount === 0) return false;
    }
    const state = getEntry(q.id).state;
    return state === "active" || state === "ready";
  });

  // extras (수락/완료대기) 를 먼저 — 플레이어의 진행 중인 일이 위에 보이도록.
  return [...extras, ...today];
}
