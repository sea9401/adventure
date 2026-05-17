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
  /**
   * 분당 자연회복량 — 0/미설정 이면 회복 없음 (일반 coop 보스 default).
   * 월드 보스용: GET/attack 시 lazy 로 elapsed × regen 만큼 hp 회복 (max_hp cap).
   * baseline sustain — "꾸준히 깎아야 잡힌다" 를 다인 누적 데미지에 강제.
   */
  regenPerMin?: number;
  /** true 면 보스 카드 UI 에 "월드 보스" 라벨/스타일 적용. lore drop 표시 톤 강화. */
  isWorldBoss?: boolean;
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
  // 5막 PR-B1 — 별빛 거인 잔영. 운봉의 거인 처치 후 별빛이 그 자리에 떨어졌다.
  // 만렙 100 협동 보스 — apex_throne(49000) / starspire(21800) 사이 톤. 진입 자격:
  // Ch 26 「별이 떨어진 자리」 완료(starfall_warden_felled) — 별빛이 흩어졌음을 본 자만.
  starlit_canyon: {
    monsterName: "별빛 거인 잔영",
    maxHp: 28000,
    expirationMs: 24 * 60 * 60 * 1000, // 24h
    respawnMs: 1 * 60 * 60 * 1000, // 1h
    onDefeatFlag: "starlit_giant_quelled",
    onAttackFlag: "starlit_giant_engaged",
    requiredFlag: "starfall_warden_felled",
    lockedMessage:
      "Ch 26 「별이 떨어진 자리」를 먼저 끝내야 한다. 별빛이 옛 봉인 자리로 흩어졌음을 한 번 본 자에게만 잔영이 모습을 드러낸다.",
  },
  // 5막 PR-B2 — 수심의 메아리. 거인 잔영(28000) 보다 한 톤 위 (30000).
  starlit_reef: {
    monsterName: "수심의 메아리",
    maxHp: 30000,
    expirationMs: 24 * 60 * 60 * 1000,
    respawnMs: 1 * 60 * 60 * 1000,
    onDefeatFlag: "starlit_deep_quelled",
    onAttackFlag: "starlit_deep_engaged",
    requiredFlag: "starfall_warden_felled",
    lockedMessage:
      "Ch 26 「별이 떨어진 자리」를 먼저 끝내야 한다. 별빛이 옛 봉인 자리로 흩어졌음을 한 번 본 자에게만 메아리가 모습을 드러낸다.",
  },
  // 5막 PR-B2 — 성문지기 잔영. 메아리(30000) 보다 한 톤 위 (33000) — 셋 중 가장 단단함.
  starlit_keep: {
    monsterName: "성문지기 잔영",
    maxHp: 33000,
    expirationMs: 24 * 60 * 60 * 1000,
    respawnMs: 1 * 60 * 60 * 1000,
    onDefeatFlag: "starlit_gate_quelled",
    onAttackFlag: "starlit_gate_engaged",
    requiredFlag: "starfall_warden_felled",
    lockedMessage:
      "Ch 26 「별이 떨어진 자리」를 먼저 끝내야 한다. 별빛이 옛 봉인 자리로 흩어졌음을 한 번 본 자에게만 잔영이 모습을 드러낸다.",
  },
  starspire: {
    monsterName: "별을 지키는 자",
    maxHp: 21800,
    expirationMs: 24 * 60 * 60 * 1000, // 24h
    respawnMs: 1 * 60 * 60 * 1000, // 1h
    onDefeatFlag: "starspire_keeper_defeated",
    onAttackFlag: "starspire_engaged",
  },
  skyfolk_ruins: {
    monsterName: "천공인의 왕",
    maxHp: 32700,
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
    maxHp: 49000,
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
  // 월드 보스 — 용비늘 묘지 너머. apex_throne 의 10배 HP + 7일 휴면.
  // expirationMs 는 사실상 만료 없음 (1년) — 죽을 때까지 살아있다는 의미.
  // 자연회복 없음: 누적 데미지만 유효, 며칠 비웠다 와도 진척이 보존된다.
  dragon_nest: {
    monsterName: "태고의 노룡",
    maxHp: 500_000,
    expirationMs: 365 * 24 * 60 * 60 * 1000, // 1y (실질 무한)
    respawnMs: 7 * 24 * 60 * 60 * 1000, // 7d 휴면
    isWorldBoss: true,
    onDefeatFlag: "primordial_dragon_felled",
    onAttackFlag: "primordial_dragon_engaged",
    // 진입 자격 — 뼈비늘 노룡 처치 이력 (wyrm_warden_felled). 같은 flag 가 region edge
    // 통행 조건이라 사실상 region 에 들어선 자는 곧 자격자 — 안전망으로 한 번 더 박는다.
    requiredFlag: "wyrm_warden_felled",
    lockedMessage:
      "뼈비늘 노룡을 한 번 쓰러뜨려야 둥지의 어미가 자네를 알아본다. 묘지의 보스를 먼저 잡고 다시 오라.",
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
