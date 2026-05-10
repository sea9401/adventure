// 협동 보스 보상 — 누적 데미지 비율로 티어 결정 + 도달 티어까지 누적 지급.
// 운봉의 거인 협동 한 보스 한정 (다른 보스 추가 시 보스별 분기 추가).

import type { MaterialId } from "@/adventure/data/materials";
import type { CoopRewardTier } from "./data";

export type CoopReward = {
  materials: Partial<Record<MaterialId, number>>;
  /** 학습 시도할 제작서 — knowsRecipe 로 이미 알고 있으면 무시. */
  recipes: string[];
  /** recipe_one_of 풀 — 하나만 무작위 추첨해 학습 시도. */
  recipeOneOf?: string[];
  /** 추가 굴림: { recipeId, chance } — chance 비율로 학습 시도. */
  recipeRolls?: { recipeId: string; chance: number }[];
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
  },
};

const TIER_TABLES: Record<string, Record<CoopRewardTier, CoopReward>> = {
  "운봉의 거인": PEAK_GIANT_TIER_REWARDS,
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
    if (r.titleId) out.titleId = r.titleId;
    if (t === tier) break;
  }
  return out;
}
