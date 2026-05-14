// 협동 보스 보상 — 누적 데미지 비율로 티어 결정 + 도달 티어까지 누적 지급.
// 운봉의 거인 협동 한 보스 한정 (다른 보스 추가 시 보스별 분기 추가).

import type { MaterialId } from "@/adventure/data/materials";
import type { ItemId } from "@/adventure/data/items";
import type { CoopRewardTier } from "./data";

export type CoopReward = {
  materials: Partial<Record<MaterialId, number>>;
  /** 학습 시도할 제작서 — knowsRecipe 로 이미 알고 있으면 무시. */
  recipes: string[];
  /** recipe_one_of 풀 — 하나만 무작위 추첨해 학습 시도. */
  recipeOneOf?: string[];
  /** 추가 굴림: { recipeId, chance } — chance 비율로 학습 시도. */
  recipeRolls?: { recipeId: string; chance: number }[];
  /** 장비 드랍 굴림: { itemId, chance } — chance 비율로 그 장비를 인벤토리에 추가. legend 티어의 물욕 드랍용. */
  equipRolls?: { itemId: ItemId; chance: number }[];
  /** 부여할 칭호. */
  titleId?: string;
};

const PEAK_GIANT_TIER_REWARDS: Record<CoopRewardTier, CoopReward> = {
  bronze: {
    materials: { giant_scale: 1 },
    recipes: [],
  },
  silver: {
    materials: { unbong_ore: 1 },
    recipes: [],
  },
  gold: {
    materials: { giant_scale: 1, unbong_ore: 1 },
    recipes: [],
    recipeOneOf: ["peak_sword", "peak_shield", "peak_spear", "peak_claw"],
    recipeRolls: [{ recipeId: "peak_mantle", chance: 0.15 }],
  },
  epic: {
    materials: {},
    recipes: ["peak_heart"],
  },
  legend: {
    materials: {},
    recipes: [],
    titleId: "giant_slayer",
    // 물욕 드랍 — legend 도달자에게도 아주 낮은 확률로만 떨어지는 unique 액세서리.
    equipRolls: [{ itemId: "peak_relic", chance: 0.02 }],
  },
};

const STAR_KEEPER_TIER_REWARDS: Record<CoopRewardTier, CoopReward> = {
  bronze: {
    materials: { stardust: 2 },
    recipes: [],
  },
  silver: {
    materials: { sky_alloy: 1 },
    recipes: [],
  },
  gold: {
    materials: { stardust: 2, sky_alloy: 1 },
    recipes: [],
    recipeOneOf: ["star_blade", "star_aegis", "star_lance", "star_grip"],
    recipeRolls: [{ recipeId: "star_mantle", chance: 0.15 }],
  },
  epic: {
    materials: { sky_alloy: 1 },
    recipes: [],
  },
  legend: {
    materials: {},
    recipes: [],
    titleId: "star_keeper",
    // 물욕 드랍 — legend 도달자에게도 아주 낮은 확률로만 떨어지는 armor 슬롯 unique.
    equipRolls: [{ itemId: "star_robe", chance: 0.01 }],
  },
};

const SKYFOLK_KING_TIER_REWARDS: Record<CoopRewardTier, CoopReward> = {
  bronze: {
    materials: { stellar_essence: 2 },
    recipes: [],
  },
  silver: {
    materials: { aether_alloy: 1 },
    recipes: [],
  },
  gold: {
    materials: { stellar_essence: 2, aether_alloy: 1 },
    recipes: [],
    recipeOneOf: ["aether_blade", "aether_aegis", "aether_lance", "aether_grip"],
    recipeRolls: [{ recipeId: "aether_mantle", chance: 0.15 }],
  },
  epic: {
    materials: { aether_alloy: 1 },
    recipes: [],
  },
  legend: {
    materials: {},
    recipes: [],
    titleId: "skyfolk_slayer",
    // 물욕 드랍 — legend 도달자 한정, 운봉령/별빛 두루마기 패턴 그대로 낮은 확률.
    equipRolls: [{ itemId: "skyfolk_crown", chance: 0.01 }],
  },
};

const SKY_ARBITER_TIER_REWARDS: Record<CoopRewardTier, CoopReward> = {
  bronze: {
    materials: { empyrean_shard: 2 },
    recipes: [],
  },
  silver: {
    materials: { primordial_essence: 1 },
    recipes: [],
  },
  gold: {
    materials: { empyrean_shard: 2, primordial_essence: 1 },
    recipes: [],
    recipeOneOf: ["empyrean_blade", "empyrean_aegis", "empyrean_lance", "empyrean_grip"],
    recipeRolls: [{ recipeId: "empyrean_mantle", chance: 0.15 }],
  },
  epic: {
    materials: { primordial_essence: 1 },
    recipes: [],
  },
  legend: {
    materials: {},
    recipes: [],
    titleId: "apex_slayer",
    // 만렙 정점 물욕 드랍 — 운봉령/별빛 두루마기/천공인의 관 같은 결, legend 도달 후 1% 굴림.
    equipRolls: [{ itemId: "apex_regalia", chance: 0.01 }],
  },
};

// 월드 보스 — 태고의 노룡. 일주일 단위 이벤트라 일반 coop 보다 보상 분량 두툼.
// gold/epic 에서 equipRolls 로 무구 4종을 직접 굴리고, legend 에 한해 정점 액세서리
// (태고의 비늘관) 가 5% 로 떨어진다 (창공의 옥새 1% 보다 후함 — 7일 한정).
const PRIMORDIAL_DRAGON_TIER_REWARDS: Record<CoopRewardTier, CoopReward> = {
  bronze: {
    materials: { dragonscale_shard: 3 },
    recipes: [],
  },
  silver: {
    materials: { bone_rune_steel: 1, scale_dust: 5 },
    recipes: [],
  },
  gold: {
    materials: { dragonscale_shard: 3, bone_rune_steel: 2 },
    recipes: [],
    // gold 도달자에게 3종 무구 중 한 자루씩 굴림 — 평균 ~50% 확률로 한 자루 획득.
    equipRolls: [
      { itemId: "primordial_blade", chance: 0.2 },
      { itemId: "primordial_aegis", chance: 0.2 },
      { itemId: "primordial_helm", chance: 0.2 },
    ],
  },
  epic: {
    materials: { bone_rune_steel: 2 },
    recipes: [],
    // epic 까지 깎은 자에게 망토 직접 굴림 — 가볍게 15%.
    equipRolls: [{ itemId: "primordial_cloak", chance: 0.15 }],
  },
  legend: {
    materials: {},
    recipes: [],
    titleId: "primordial_slayer",
    // 만렙 정점 물욕 드랍 — 창공의 옥새(1%) 위. 7일 한 번 시도 가능하니 5%.
    equipRolls: [{ itemId: "primordial_regalia", chance: 0.05 }],
  },
};

const TIER_TABLES: Record<string, Record<CoopRewardTier, CoopReward>> = {
  "운봉의 거인": PEAK_GIANT_TIER_REWARDS,
  "별을 지키는 자": STAR_KEEPER_TIER_REWARDS,
  "천공인의 왕": SKYFOLK_KING_TIER_REWARDS,
  "창공의 주재": SKY_ARBITER_TIER_REWARDS,
  "태고의 노룡": PRIMORDIAL_DRAGON_TIER_REWARDS,
};

const TIER_ORDER: CoopRewardTier[] = ["bronze", "silver", "gold", "epic", "legend"];

/**
 * 도달 티어까지의 모든 누적 보상 합산.
 * gold 도달이면 bronze + silver + gold 의 보상이 합쳐진다.
 */
export function computeCoopReward(
  bossName: string,
  tier: CoopRewardTier,
): CoopReward {
  const table = TIER_TABLES[bossName];
  if (!table) return { materials: {}, recipes: [] };

  const out: CoopReward = { materials: {}, recipes: [] };
  for (const t of TIER_ORDER) {
    const r = table[t];
    for (const [k, v] of Object.entries(r.materials)) {
      const id = k as MaterialId;
      out.materials[id] = (out.materials[id] ?? 0) + (v ?? 0);
    }
    out.recipes.push(...r.recipes);
    if (r.recipeOneOf) {
      out.recipeOneOf = [...(out.recipeOneOf ?? []), ...r.recipeOneOf];
    }
    if (r.recipeRolls) {
      out.recipeRolls = [...(out.recipeRolls ?? []), ...r.recipeRolls];
    }
    if (r.equipRolls) {
      out.equipRolls = [...(out.equipRolls ?? []), ...r.equipRolls];
    }
    if (r.titleId) out.titleId = r.titleId;
    if (t === tier) break;
  }
  return out;
}
