import { describe, expect, it } from "vitest";
import { MONSTERS } from "./monsters";
import { RECIPES, getRecipeById } from "./recipes";
import { QUESTS } from "./quests";
import { ITEMS } from "./items";

// 데이터 정합성 — 콘텐츠가 늘어나면서 ID 참조가 깨지지 않게.
// "제작법이 드랍됐는데 대장간에 안 뜨는" 사고를 컴파일/CI 단계에서 잡는다.

describe("monster drops 가 모든 ID 참조 정합성", () => {
  for (const [name, monster] of Object.entries(MONSTERS)) {
    if (!monster.drops) continue;
    for (const drop of monster.drops) {
      if (drop.kind === "recipe") {
        it(`${name} → recipe ${drop.recipeId}`, () => {
          expect(getRecipeById(drop.recipeId)).toBeDefined();
        });
      } else if (drop.kind === "recipe_one_of") {
        for (const id of drop.recipeIds) {
          it(`${name} → recipe_one_of ${id}`, () => {
            expect(getRecipeById(id)).toBeDefined();
          });
        }
      } else if (drop.kind === "equip") {
        it(`${name} → equip ${drop.itemId}`, () => {
          expect(ITEMS[drop.itemId]).toBeDefined();
        });
      }
    }
  }
});

describe("quest reward 가 모든 ID 참조 정합성", () => {
  for (const q of QUESTS) {
    for (const id of q.reward.recipes ?? []) {
      it(`${q.id} → recipe ${id}`, () => {
        expect(getRecipeById(id)).toBeDefined();
      });
    }
    for (const it_ of q.reward.items ?? []) {
      it(`${q.id} → item ${it_.id}`, () => {
        expect(ITEMS[it_.id]).toBeDefined();
      });
    }
  }
});

describe("recipe 가 결과 itemId 참조 정합성", () => {
  for (const r of RECIPES) {
    if (r.result.kind === "equipment") {
      const itemId = r.result.itemId;
      it(`${r.id} → equipment ${itemId}`, () => {
        expect((ITEMS as Record<string, unknown>)[itemId]).toBeDefined();
      });
    }
  }
});
