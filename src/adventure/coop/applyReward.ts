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
  /**
   * 칭호 부여 — useTitleGrant 의 grantTitle 권장. markTitleObtained 만 호출하면
   * 토스트 알림 / 잔영 컬렉션 체인(starlit_quietener)이 누락된다.
   */
  grantTitle: (titleId: string) => void;
};

/** 실제로 적용된 보상 요약 — 보스 카드의 보상 로그 표시에 사용. */
export type AppliedCoopReward = {
  materials: { id: MaterialId; name: string; count: number }[];
  recipes: { id: string; name: string }[];
  equipment: { id: ItemId; name: string }[];
  title?: { id: string; name: string };
};

/**
 * 협동 보스 claim 보상 적용 — 재료 / 제작서 / 장비 / 칭호.
 * RNG 굴림(recipeOneOf 추첨 / recipeRolls / equipRolls) 은 서버가 이미 풀어
 * recipes 와 equipment 배열로 합쳐 보낸다. 클라는 받은 그대로 시도.
 * 반환값은 "이번에 실제로 들어온 것" — 이미 보유 중인 제작서는 제외.
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

  // 2) 제작서 — 미보유면 학습.
  for (const recipeId of reward.recipes) {
    if (s.knowsRecipe(recipeId)) continue;
    s.learnRecipe(recipeId);
    const def = getRecipeById(recipeId);
    applied.recipes.push({ id: recipeId, name: def?.name ?? recipeId });
  }

  // 3) 장비 드랍.
  for (const itemIdStr of reward.equipment) {
    const itemId = itemIdStr as ItemId;
    s.addEquipment(itemId, 1);
    const def = ITEMS[itemId as keyof typeof ITEMS];
    applied.equipment.push({ id: itemId, name: def?.name ?? itemIdStr });
  }

  // 4) 칭호 — grantTitle 로 토스트 + 컬렉션 체인 함께 처리.
  if (reward.titleId) {
    s.grantTitle(reward.titleId);
    const def = TITLES[reward.titleId];
    applied.title = { id: reward.titleId, name: def?.name ?? reward.titleId };
  }

  return applied;
}
