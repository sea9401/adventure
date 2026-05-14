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
  /** 진입 조건 storyFlag — 셋팅 안 됐으면 보스 카드 잠금 (게이트 의뢰 완료로 풀림). */
  requiredFlag?: string;
  /** 잠금 상태에서 보여줄 메시지 (어떤 의뢰가 자격을 여는지 안내). */
  lockedMessage?: string;
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
    // 진입 자격 — 별바다 노수호자 유성의 "폐도의 봉인" 의뢰 완료 시 풀림.
    requiredFlag: "skyfolk_gate_cleared",
    lockedMessage:
      "별바다의 노수호자 유성에게 '폐도의 봉인' 의뢰를 받아 완료해야 한다. 폐도의 결을 먼저 풀어야 천공인의 왕이 자네를 알아본다.",
  },
  apex_throne: {
    monsterName: "창공의 주재",
    maxHp: 45000,
    expirationMs: 24 * 60 * 60 * 1000, // 24h
    respawnMs: 1 * 60 * 60 * 1000, // 1h
    // 만렙 정점 — 처치 시 6번째 일반 슬롯 + 2번째 특기 슬롯 동시 해금 (SKILL_SLOT_UNLOCK 참조).
    onDefeatFlag: "endgame_apex_defeated",
    onAttackFlag: "apex_engaged",
    // 진입 자격 — 별바다 노수호자 유성의 "옥좌의 봉인" 의뢰 완료 시 풀림.
    requiredFlag: "apex_gate_cleared",
    lockedMessage:
      "별바다의 노수호자 유성에게 '옥좌의 봉인' 의뢰를 받아 완료해야 한다. 옥좌 둘레의 결을 풀어야 창공의 주재가 자네 앞에 일어선다.",
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
