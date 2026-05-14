// 고탑 층 스케일링 — 베이스 mob/보스 스탯에 층 함수를 곱해 실제 전투에 쓰이는 스탯을 산출.
// 공식 (메모 합의 / sim-tower.ts 프로필 A):
//   HP  × F^0.45
//   ATK × F^0.25
//   DEF × F^0.25
//   F   = 층 번호 (1, 2, 3, ...)
//
// 베이스는 풀 매핑(floorPools.ts) 의 entry 가 지정한 monsterName 의 MONSTERS 항목 + 옵션
// bossMultiplier. 결과는 정수로 반올림.

import type { Monster } from "@/adventure/data/monsters";
import { TOWER_BOSS_INTERVAL } from "./types";

export const TOWER_HP_EXP = 0.45;
export const TOWER_ATK_EXP = 0.25;
export const TOWER_DEF_EXP = 0.25;

/** 보스층 여부 — 10/20/30/... */
export function isBossFloor(floor: number): boolean {
  return floor > 0 && floor % TOWER_BOSS_INTERVAL === 0;
}

/** 보스층이면 그 보스의 슬롯 인덱스(0-based, 10층 → 0, 20층 → 1, ...) */
export function bossSlotForFloor(floor: number): number | null {
  if (!isBossFloor(floor)) return null;
  return Math.floor(floor / TOWER_BOSS_INTERVAL) - 1;
}

/** 가장 가까운(현재 층 이하) 보스층. 1~9 → 0, 10~19 → 10, ... */
export function lastBossFloorAtOrBelow(floor: number): number {
  if (floor <= 0) return 0;
  return Math.floor(floor / TOWER_BOSS_INTERVAL) * TOWER_BOSS_INTERVAL;
}

/** 클리어한 최고층 → 다음 시도 시작층. 첫 시도면 1. */
export function startFloorAfterCheckpoint(highestFloor: number): number {
  return lastBossFloorAtOrBelow(highestFloor) + 1;
}

export type ScaledStats = {
  hp: number;
  atk: number;
  def: number;
  spd: number;
};

/** 베이스 몬스터 + 층 + (옵션) 보스 배수 → 실제 전투 스탯. */
export function scaledStats(
  base: Pick<Monster, "hp" | "atk" | "def" | "spd">,
  floor: number,
  bossMultiplier = 1,
): ScaledStats {
  const f = Math.max(1, floor);
  const m = bossMultiplier;
  return {
    hp: Math.max(1, Math.round(base.hp * m * Math.pow(f, TOWER_HP_EXP))),
    atk: Math.max(1, Math.round(base.atk * m * Math.pow(f, TOWER_ATK_EXP))),
    def: Math.max(0, Math.round(base.def * m * Math.pow(f, TOWER_DEF_EXP))),
    spd: base.spd, // 속도는 스케일링하지 않음 — 행동 순서가 층마다 뒤집히는 걸 막기 위함.
  };
}
