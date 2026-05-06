import type { CoopBossDef, CoopRewardTier, CoopTierReward, Materials } from "../types";

// 협동 보스 보상 티어 — 모든 보스 공통 임계치 (HP 비율 0~1).
// docs/15-coop-reward-tier-plan.md 참고.
export const COOP_TIER_THRESHOLDS: Record<CoopRewardTier, number> = {
  bronze: 0.02,
  silver: 0.07,
  gold: 0.15,
  epic: 0.3,
  legend: 0.5,
};

export const COOP_TIER_ORDER: CoopRewardTier[] = ["bronze", "silver", "gold", "epic", "legend"];

export const COOP_TIER_LABEL: Record<CoopRewardTier, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  epic: "EPIC",
  legend: "LEGEND",
};

// 보스 처치 후 HP 대비 누적 데미지 비율(0~1)을 받아 도달한 최고 티어를 반환.
// 최소 임계치(bronze) 미달이면 null.
export function coopTierForRatio(ratio: number): CoopRewardTier | null {
  let achieved: CoopRewardTier | null = null;
  for (const tier of COOP_TIER_ORDER) {
    if (ratio >= COOP_TIER_THRESHOLDS[tier]) achieved = tier;
    else break;
  }
  return achieved;
}

// 도달 티어까지의 증분 보상을 합산해 최종 지급량을 계산.
export function sumCoopTierRewards(
  tier: CoopRewardTier,
  rewards: Record<CoopRewardTier, CoopTierReward>,
): CoopTierReward {
  const out: CoopTierReward = { gold: 0, iron: 0, materials: {} as Materials };
  for (const t of COOP_TIER_ORDER) {
    const r = rewards[t];
    out.gold += r.gold;
    out.iron += r.iron;
    for (const [k, v] of Object.entries(r.materials)) {
      if (!v) continue;
      out.materials[k as keyof Materials] = (out.materials[k as keyof Materials] ?? 0) + v;
    }
    if (t === tier) break;
  }
  return out;
}

export function nextCoopTier(tier: CoopRewardTier | null): CoopRewardTier | null {
  if (tier === null) return "bronze";
  const idx = COOP_TIER_ORDER.indexOf(tier);
  return idx >= 0 && idx < COOP_TIER_ORDER.length - 1 ? COOP_TIER_ORDER[idx + 1] : null;
}

export const COOP_BOSSES: Record<string, CoopBossDef> = {
  san_gun: {
    id: "san_gun",
    name: "산군",
    hp: 15000,
    atk: 200,
    def: 50,
    mdef: 15,
    spd: 4,
    agi: 5,
    int: 0,
    durationSec: 7200, // 2시간
    rewardTiers: {
      thresholds: COOP_TIER_THRESHOLDS,
      // 산군 — bronze 외 silver/gold/epic/legend 보상은 절반으로 하향 (인플레이션 보정).
      // 풀 합계: gold 16k / iron 6.4k / pelt 10 (단일 legend 도달 시).
      rewards: {
        bronze: { gold: 2000, iron: 800, materials: { mountain_lord_pelt: 1 } },
        silver: { gold: 2250, iron: 900, materials: { mountain_lord_pelt: 2 } },
        gold: { gold: 3000, iron: 1200, materials: { mountain_lord_pelt: 2 } },
        epic: { gold: 3750, iron: 1500, materials: { mountain_lord_pelt: 2 } },
        legend: { gold: 5000, iron: 2000, materials: { mountain_lord_pelt: 3 } },
      },
    },
    summonItem: "san_gun_summon",
    skill: {
      name: "호랑이 발톱",
      cooldown: 6,
      effect: { kind: "flat_damage", atkMult: 1.0 },
    },
    flavor: "마을 외곽 산악의 신수. 호랑이의 영혼이 깃든 거대한 짐승.",
  },
  griffon: {
    id: "griffon",
    name: "그리폰",
    hp: 25000,
    atk: 380,
    def: 130,
    mdef: 46,
    spd: 6,
    agi: 8,
    int: 0,
    durationSec: 7200, // 2시간
    rewardTiers: {
      thresholds: COOP_TIER_THRESHOLDS,
      // 그리폰 — bronze 외 절반 하향. 풀 합계: gold 32k / iron 9.6k / feather 10.
      rewards: {
        bronze: { gold: 4000, iron: 1200, materials: { griffon_feather: 1 } },
        silver: { gold: 4500, iron: 1350, materials: { griffon_feather: 2 } },
        gold: { gold: 6000, iron: 1800, materials: { griffon_feather: 2 } },
        epic: { gold: 7500, iron: 2250, materials: { griffon_feather: 2 } },
        legend: { gold: 10000, iron: 3000, materials: { griffon_feather: 3 } },
      },
    },
    summonItem: "griffon_summon",
    skill: {
      name: "벼락 강하",
      cooldown: 6,
      effect: { kind: "flat_damage", atkMult: 1.0 },
    },
    flavor: "오지 상공의 포식자. 한 번의 발톱이 숲을 가른다.",
  },
  kraken: {
    id: "kraken",
    name: "크라켄",
    hp: 50000,
    atk: 550,
    def: 180,
    mdef: 70,
    spd: 5,
    agi: 6,
    int: 0,
    durationSec: 7200, // 2시간
    rewardTiers: {
      thresholds: COOP_TIER_THRESHOLDS,
      // 크라켄 — bronze 외 절반 하향. 풀 합계: gold 64k / iron 19.2k / tentacle 10.
      rewards: {
        bronze: { gold: 8000, iron: 2400, materials: { kraken_tentacle: 1 } },
        silver: { gold: 9000, iron: 2700, materials: { kraken_tentacle: 2 } },
        gold: { gold: 12000, iron: 3600, materials: { kraken_tentacle: 2 } },
        epic: { gold: 15000, iron: 4500, materials: { kraken_tentacle: 2 } },
        legend: { gold: 20000, iron: 6000, materials: { kraken_tentacle: 3 } },
      },
    },
    summonItem: "kraken_summon",
    skill: {
      name: "촉수 휩쓸기",
      cooldown: 6,
      effect: { kind: "flat_damage", atkMult: 1.0 },
    },
    flavor: "해적 섬 심해에서 솟아오르는 거대 두족류. 한 번의 휘두름이 함선을 갈라낸다.",
  },
};

export const COOP_ATTACK_COOLDOWN_MS = 30_000;
export const COOP_ATTACK_TURNS = 30;
