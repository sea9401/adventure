import { describe, expect, it } from "vitest";
import { MONSTERS } from "./monsters";
import { RECIPES, getRecipeById } from "./recipes";
import { QUESTS } from "./quests";
import { ITEMS } from "./items";
import { MATERIALS } from "./materials";
import { NPCS } from "./npcs";
import { WORLD_MAP } from "./world";

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

describe("recipe id / 재료 / equip→equip 체인 정합성", () => {
  it("recipe id 가 유일하다", () => {
    const ids = RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  for (const r of RECIPES) {
    for (const ing of r.ingredients) {
      if (ing.kind === "material") {
        const mid = ing.materialId;
        it(`${r.id} ← material ${mid}`, () => {
          expect((MATERIALS as Record<string, unknown>)[mid]).toBeDefined();
        });
      } else {
        const iid = ing.itemId;
        it(`${r.id} ← equip ${iid}`, () => {
          expect((ITEMS as Record<string, unknown>)[iid]).toBeDefined();
        });
        // 자기 자신을 재료로 쓰는 무한 루프 방지.
        it(`${r.id} 는 자기 결과물을 재료로 쓰지 않는다`, () => {
          if (r.result.kind === "equipment") {
            expect(iid).not.toBe(r.result.itemId);
          }
        });
      }
    }
  }
});

describe("quest 의 target / requiresQuestCompleted 참조 정합성", () => {
  const questIds = new Set(QUESTS.map((q) => q.id));
  // id 중복 없음.
  it("quest id 가 유일하다", () => {
    expect(questIds.size).toBe(QUESTS.length);
  });
  for (const q of QUESTS) {
    const target = q.target;
    if (
      target.kind === "kill" ||
      target.kind === "kill_within_hp" ||
      target.kind === "no_potion_boss" ||
      target.kind === "coop_tier_reached" ||
      target.kind === "coop_high_dmg_attack" ||
      target.kind === "coop_survive_attack"
    ) {
      const monsterName = target.monsterName;
      it(`${q.id} → monster "${monsterName}"`, () => {
        expect((MONSTERS as Record<string, unknown>)[monsterName]).toBeDefined();
      });
    } else if (target.kind === "deliver") {
      const materialId = target.materialId;
      it(`${q.id} → material ${materialId}`, () => {
        expect((MATERIALS as Record<string, unknown>)[materialId]).toBeDefined();
      });
    } else if (target.kind === "talk_to_npc") {
      const npcId = target.npcId;
      it(`${q.id} → npc ${npcId}`, () => {
        expect(NPCS.some((n) => n.id === npcId)).toBe(true);
      });
    } else if (target.kind === "visit_region") {
      const regionId = target.regionId;
      it(`${q.id} → region ${regionId}`, () => {
        expect(WORLD_MAP.regions.some((r) => r.id === regionId)).toBe(true);
      });
    } else if (target.kind === "craft_item" || target.kind === "equip_item") {
      const itemId = target.itemId;
      it(`${q.id} → item ${itemId}`, () => {
        expect((ITEMS as Record<string, unknown>)[itemId]).toBeDefined();
      });
    } else if (target.kind === "equip_set") {
      for (const itemId of target.itemIds) {
        it(`${q.id} → set item ${itemId}`, () => {
          expect((ITEMS as Record<string, unknown>)[itemId]).toBeDefined();
        });
      }
    }
    for (const m of q.reward.materials ?? []) {
      const mid = m.id;
      it(`${q.id} → reward material ${mid}`, () => {
        expect((MATERIALS as Record<string, unknown>)[mid]).toBeDefined();
      });
    }
    if (q.requiresQuestCompleted) {
      const req = q.requiresQuestCompleted;
      it(`${q.id} → requires ${req}`, () => {
        expect(questIds.has(req)).toBe(true);
      });
    }
  }
});
