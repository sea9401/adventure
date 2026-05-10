import type { MaterialId } from "@/adventure/data/materials";
import type { CoopClaimResponse } from "./useCoopBoss";

type Services = {
  addMaterial: (id: MaterialId, n: number) => void;
  learnRecipe: (id: string) => void;
  knowsRecipe: (id: string) => boolean;
  markTitleObtained: (titleId: string) => void;
};

/**
 * 협동 보스 claim 보상 적용 — 재료 / 제작서 / 칭호.
 * recipeOneOf 는 미보유만 추려 균등 추첨, recipeRolls 는 chance 비율로 학습.
 */
export function applyCoopReward(
  reward: CoopClaimResponse["reward"],
  s: Services,
): void {
  // 1) 재료.
  for (const [id, n] of Object.entries(reward.materials)) {
    if (!n) continue;
    s.addMaterial(id as MaterialId, n);
  }

  // 2) 확정 제작서.
  for (const recipeId of reward.recipes) {
    if (!s.knowsRecipe(recipeId)) s.learnRecipe(recipeId);
  }

  // 3) recipe_one_of — 미보유만 추려 균등 추첨.
  if (reward.recipeOneOf && reward.recipeOneOf.length > 0) {
    const unknown = reward.recipeOneOf.filter((id) => !s.knowsRecipe(id));
    if (unknown.length > 0) {
      const pick = unknown[Math.floor(Math.random() * unknown.length)];
      s.learnRecipe(pick);
    }
  }

  // 4) recipeRolls — chance 비율로 학습 시도.
  if (reward.recipeRolls) {
    for (const roll of reward.recipeRolls) {
      if (s.knowsRecipe(roll.recipeId)) continue;
      if (Math.random() < roll.chance) s.learnRecipe(roll.recipeId);
    }
  }

  // 5) 칭호.
  if (reward.titleId) s.markTitleObtained(reward.titleId);
}
