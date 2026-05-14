import { ITEMS, type ItemId } from "@/adventure/data/items";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { getRecipeById } from "@/adventure/data/recipes";
import { TITLES } from "@/adventure/data/titles";
import type { CoopClaimResponse } from "./useCoopBoss";

type Services = {
  addMaterial: (id: MaterialId, n: number) => void;
  learnRecipe: (id: string) => void;
  knowsRecipe: (id: string) => boolean;
  addEquipment: (id: ItemId, n: number) => void;
  markTitleObtained: (titleId: string) => void;
};

/** 실제로 적용된 보상 요약 — 보스 카드의 보상 로그 표시에 사용. */
export type AppliedCoopReward = {
  materials: { id: MaterialId; name: string; count: number }[];
  recipes: { id: string; name: string }[];
  equipment: { id: ItemId; name: string }[];
  title?: { id: string; name: string };
};

/**
 * 협동 보스 claim 보상 적용 — 재료 / 제작서 / 칭호.
 * recipeOneOf 는 미보유만 추려 균등 추첨, recipeRolls 는 chance 비율로 학습.
 * 반환값은 "이번에 실제로 들어온 것" — 이미 보유 중인 제작서 / 0% 굴림 등은 제외.
 */
export function applyCoopReward(
  reward: CoopClaimResponse["reward"],
  s: Services,
): AppliedCoopReward {
  const applied: AppliedCoopReward = {
    materials: [],
    recipes: [],
    equipment: [],
  };

  // 1) 재료.
  for (const [id, n] of Object.entries(reward.materials)) {
    if (!n) continue;
    const mid = id as MaterialId;
    s.addMaterial(mid, n);
    const def = MATERIALS[mid];
    applied.materials.push({ id: mid, name: def?.name ?? id, count: n });
  }

  // 2) 확정 제작서 — 미보유면 학습. 기존 보유면 로그에서도 제외.
  for (const recipeId of reward.recipes) {
    if (s.knowsRecipe(recipeId)) continue;
    s.learnRecipe(recipeId);
    const def = getRecipeById(recipeId);
    applied.recipes.push({ id: recipeId, name: def?.name ?? recipeId });
  }

  // 3) recipe_one_of — 미보유만 추려 균등 추첨.
  if (reward.recipeOneOf && reward.recipeOneOf.length > 0) {
    const unknown = reward.recipeOneOf.filter((id) => !s.knowsRecipe(id));
    if (unknown.length > 0) {
      const pick = unknown[Math.floor(Math.random() * unknown.length)];
      s.learnRecipe(pick);
      const def = getRecipeById(pick);
      applied.recipes.push({ id: pick, name: def?.name ?? pick });
    }
  }

  // 4) recipeRolls — chance 비율로 학습 시도.
  if (reward.recipeRolls) {
    for (const roll of reward.recipeRolls) {
      if (s.knowsRecipe(roll.recipeId)) continue;
      if (Math.random() < roll.chance) {
        s.learnRecipe(roll.recipeId);
        const def = getRecipeById(roll.recipeId);
        applied.recipes.push({
          id: roll.recipeId,
          name: def?.name ?? roll.recipeId,
        });
      }
    }
  }

  // 5) equipRolls — chance 비율로 장비 드랍 (legend 물욕템 등).
  if (reward.equipRolls) {
    for (const roll of reward.equipRolls) {
      if (Math.random() < roll.chance) {
        const itemId = roll.itemId as ItemId;
        s.addEquipment(itemId, 1);
        const def = ITEMS[itemId as keyof typeof ITEMS];
        applied.equipment.push({
          id: itemId,
          name: def?.name ?? roll.itemId,
        });
      }
    }
  }

  // 6) 칭호.
  if (reward.titleId) {
    s.markTitleObtained(reward.titleId);
    const def = TITLES[reward.titleId];
    applied.title = { id: reward.titleId, name: def?.name ?? reward.titleId };
  }

  return applied;
}
