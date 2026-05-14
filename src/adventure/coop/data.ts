// 협동 보스 정의 — region 별 어떤 보스가 등장하는지 + maxHp 오버라이드.
// 보스 stat (atk/def/spd/페이즈 등) 은 monsters.ts 의 정의 그대로 사용.
// hp 만 협동용으로 부풀려 (monsters.ts 솔로 hp 보다 큰 maxHp).

import type { RegionId } from "@/adventure/data/world";

export type CoopBossDef = {
  /** monsters.ts 의 키. 시뮬 시 같은 stat 사용. */
  monsterName: string;
  /** 협동 버전 maxHp — monsters.ts 의 솔로 hp 와 별개로 정의. */
  maxHp: number;
  /** 보스 등장 후 만료까지 (ms). */
  expirationMs: number;
  /** 처치 또는 만료 후 다음 등장까지 (ms). */
  respawnMs: number;
  /** 보스 처치 시 set 할 storyFlag. */
  onDefeatFlag?: string;
  /** 보스에 1회 이상 attack 한 시점에 set 할 storyFlag (참여 unlock 용). */
  onAttackFlag?: string;
};

export const COOP_BOSSES: Partial<Record<RegionId, CoopBossDef>> = {
  canyon: {
    monsterName: "운봉의 거인",
    maxHp: 5000,
    expirationMs: 24 * 60 * 60 * 1000, // 24h
    respawnMs: 1 * 60 * 60 * 1000, // 1h (처치/만료 동일)
    onDefeatFlag: "peak_giant_defeated",
    onAttackFlag: "peak_giant_engaged",
  },
  starspire: {
    monsterName: "별을 지키는 자",
    maxHp: 20000,
    expirationMs: 24 * 60 * 60 * 1000, // 24h
    respawnMs: 1 * 60 * 60 * 1000, // 1h
    onDefeatFlag: "starspire_keeper_defeated",
    onAttackFlag: "starspire_engaged",
  },
  skyfolk_ruins: {
    monsterName: "천공인의 왕",
    maxHp: 30000,
    expirationMs: 24 * 60 * 60 * 1000, // 24h
    respawnMs: 1 * 60 * 60 * 1000, // 1h
    onDefeatFlag: "skyfolk_king_defeated",
    onAttackFlag: "skyfolk_engaged",
  },
};

// 5단계 reward tier — 누적 데미지 / maxHp 비율 임계.
export type CoopRewardTier = "bronze" | "silver" | "gold" | "epic" | "legend";

export const COOP_TIER_ORDER: CoopRewardTier[] = [
  "bronze",
  "silver",
  "gold",
  "epic",
  "legend",
];

export const COOP_TIER_THRESHOLDS: Record<CoopRewardTier, number> = {
  bronze: 0.03,
  silver: 0.1,
  gold: 0.2,
  epic: 0.4,
  legend: 0.6,
};

export const COOP_TIER_LABEL: Record<CoopRewardTier, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  epic: "EPIC",
  legend: "LEGEND",
};

/**
 * 누적 데미지 비율 (0~1) → 도달한 최고 티어.
 * bronze 미달이면 null.
 */
export function coopTierForRatio(ratio: number): CoopRewardTier | null {
  let achieved: CoopRewardTier | null = null;
  for (const tier of COOP_TIER_ORDER) {
    if (ratio >= COOP_TIER_THRESHOLDS[tier]) achieved = tier;
    else break;
  }
  return achieved;
}

// 1회 공격 시뮬 턴 수 + 공격 간 쿨다운.
export const COOP_ATTACK_TURNS = 20;
export const COOP_ATTACK_COOLDOWN_MS = 5 * 60 * 1000; // 5분
