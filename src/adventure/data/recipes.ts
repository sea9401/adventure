import { ITEMS, type EquipSlot, type ItemId } from "./items";
import type { MaterialId } from "./materials";

export type { EquipSlot } from "./items";

export type RecipeIngredient = { materialId: MaterialId; count: number };

export type Recipe = {
  id: string;
  name: string;
  description: string;
  result: ItemId;
  slot: EquipSlot;
  ingredients: RecipeIngredient[];
};

export const RECIPES: Recipe[] = [
  {
    id: "baseball_bat",
    name: "야구 방망이 제작서",
    description: `${ITEMS.baseball_bat.name}을(를) 만든다. 손맛이 묵직하다.`,
    result: "baseball_bat",
    slot: "weapon",
    ingredients: [{ materialId: "branch", count: 1 }],
  },
];

export function getRecipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}
