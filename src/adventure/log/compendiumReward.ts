import { MONSTER_THRESHOLDS } from "./thresholds";
import type { AdventureLog } from "./storage";

// 모험의 서 등록 항목 N개당 단련 포인트 1을 보상한다.
export const COMPENDIUM_ENTRIES_PER_POINT = 20;

// 몬스터는 "도감 완전 공개" 단계에 도달한 종만 1개로 카운트.
// thresholds.ts 의 단계 3 = kills >= 300 (스탯/드랍 종류 공개).
// 단계 4(1000킬) 보다 한 단계 낮춰 일반 적도 도달 가능하게 한다.
export const COMPENDIUM_MONSTER_COMPLETE_KILLS = MONSTER_THRESHOLDS[1];

export type CompendiumCounts = {
  places: number; // 방문한 지역(마을·사냥터 모두)
  monsters: number; // 300킬 이상 몬스터 종
  npcs: number; // 1회 이상 대화한 NPC
  items: number; // 도감에 등록된 장비 종
  titles: number; // 획득한 칭호
  total: number; // 합계 — 단련 포인트 환산에 사용
};

export function countCompendiumEntries(log: AdventureLog): CompendiumCounts {
  const places = Object.values(log.towns).filter((t) => t.visited).length;
  const monsters = Object.values(log.monsters).filter(
    (m) => m.kills >= COMPENDIUM_MONSTER_COMPLETE_KILLS,
  ).length;
  const npcs = Object.values(log.npcs).filter((n) => n.talkCount > 0).length;
  const items = Object.keys(log.discoveredEquipment ?? {}).length;
  const titles = Object.keys(log.titles).length;
  const total = places + monsters + npcs + items + titles;
  return { places, monsters, npcs, items, titles, total };
}

export type CompendiumRewardState = {
  counts: CompendiumCounts;
  /** 누적 가능 단련 포인트 (= floor(total/20)). */
  earnedTotal: number;
  /** 이미 수령한 포인트 수. */
  claimed: number;
  /** 지금 수령할 수 있는 포인트 수. */
  available: number;
  /** 다음 1포인트까지 더 필요한 등록 수. */
  toNext: number;
};

export function computeCompendiumReward(
  log: AdventureLog,
): CompendiumRewardState {
  const counts = countCompendiumEntries(log);
  const earnedTotal = Math.floor(counts.total / COMPENDIUM_ENTRIES_PER_POINT);
  const claimed = log.compendiumPointsClaimed ?? 0;
  const available = Math.max(0, earnedTotal - claimed);
  const remainder = counts.total % COMPENDIUM_ENTRIES_PER_POINT;
  const toNext = COMPENDIUM_ENTRIES_PER_POINT - remainder;
  return { counts, earnedTotal, claimed, available, toNext };
}
