// 제작 서버 lib — /api/craft 의 핵심 로직.
//
// 이전엔 page.tsx 의 handleCraft 가 클라에서 재료 차감 + 결과 지급을 직접 했다 — devtools 로
// 재료/결과 위조 가능 (audit-findings #1 후속). 서버 권위로 전환: 클라는 recipeId 만 보내고,
// 서버가 inventory.v2 / crafting.v2 를 잠그고 검증한 뒤 한 트랜잭션 안에서 적용. 제작 품질
// 등급(craftTier)도 서버에서 추첨(rollCraftTier)하므로 클라가 등급을 조작할 수 없다.
//
// 순수 계산(computeCraftOutcome)과 DB I/O(applyCraftAction)를 분리 — 전자는 단위 테스트 대상.

import { and, eq } from "drizzle-orm";
import { savesKv } from "@/db/schema";
import { upsertSave, type DbExecutor } from "@/lib/server/savesKv";
import { potionMax } from "@/adventure/data/potions";
import { getRecipeById, recipeHasVariance } from "@/adventure/data/recipes";
import { rollCraftTier, type CraftTier } from "@/adventure/data/craftQuality";
import type { CraftOutcome, CraftResult } from "@/adventure/crafting/types";

export type { CraftOutcome, CraftResult };

// 호출부(route)가 HTTP 400 으로 매핑 — 모두 "요청이 게임 규칙 위반" 케이스.
export class CraftError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "CraftError";
  }
}

type CountMap = Record<string, number>;
// 등급별 인스턴스 맵 — itemId → (등급키 → 개수). 제작산(craftedEquipment, 키 "-2".."2")과
// 드랍산(droppedEquipment, 키 "1"|"2")이 같은 모양.
type GradedMap = Record<string, Record<string, number>>;

// 낮은 등급부터 소비할 때의 순서.
const NON_ZERO_TIERS = ["-2", "-1", "1", "2"] as const;
const NON_ZERO_DROP_QUALITIES = ["1", "2"] as const;

export type CraftComputeInput = {
  potions: CountMap;
  materials: CountMap;
  equipment: CountMap;
  craftedEquipment: GradedMap;
  /** 드랍 고품질 인스턴스. equip 재료 소비 시 equipment[] → craftedEquipment 다음 순서로 빠진다. 미동봉이면 빈 맵. */
  droppedEquipment?: GradedMap;
  potionCapacityBonus: number;
  known: string[];
};

export type CraftComputeResult = {
  potions: CountMap;
  materials: CountMap;
  equipment: CountMap;
  craftedEquipment: GradedMap;
  droppedEquipment: GradedMap;
  result: CraftResult;
};

function cloneGraded(src: GradedMap): GradedMap {
  const out: GradedMap = {};
  for (const [k, v] of Object.entries(src)) out[k] = { ...v };
  return out;
}

function gradedTotal(map: GradedMap, itemId: string): number {
  const grades = map[itemId];
  if (!grades) return 0;
  let total = 0;
  for (const v of Object.values(grades)) total += v ?? 0;
  return total;
}

// equip 재료 한 종을 count 개 소비 — equipment[] → graded 맵의 keyOrder 순서로. 부족하면 남은 수 반환.
function drainGraded(
  map: GradedMap,
  itemId: string,
  keyOrder: readonly string[],
  remaining: number,
): number {
  if (remaining <= 0) return 0;
  const grades = map[itemId] ?? {};
  for (const k of keyOrder) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, grades[k] ?? 0);
    if (take > 0) {
      grades[k] = (grades[k] ?? 0) - take;
      remaining -= take;
    }
  }
  map[itemId] = grades;
  return remaining;
}

function cleanupGraded(map: GradedMap): void {
  for (const k of Object.keys(map)) {
    const grades = map[k];
    for (const g of Object.keys(grades)) if (!grades[g]) delete grades[g];
    if (Object.keys(grades).length === 0) delete map[k];
  }
}

// 순수 함수 — savesKv 읽은 값으로 새 상태 + result 를 계산. 위반 시 CraftError.
export function computeCraftOutcome(
  input: CraftComputeInput,
  recipeId: string,
  rng: () => number = Math.random,
): CraftComputeResult {
  const recipe = getRecipeById(recipeId);
  if (!recipe) throw new CraftError("unknown_recipe");
  if (!input.known.includes(recipe.id)) throw new CraftError("not_learned");

  const potions = { ...input.potions };
  const materials = { ...input.materials };
  const equipment = { ...input.equipment };
  const crafted = cloneGraded(input.craftedEquipment);
  const dropped = cloneGraded(input.droppedEquipment ?? {});

  // 1) 재료 충족 검사
  for (const ing of recipe.ingredients) {
    if (ing.kind === "material") {
      if ((materials[ing.materialId] ?? 0) < ing.count)
        throw new CraftError("missing_material");
    } else {
      const have =
        (equipment[ing.itemId] ?? 0) +
        gradedTotal(crafted, ing.itemId) +
        gradedTotal(dropped, ing.itemId);
      if (have < ing.count) throw new CraftError("missing_ingredient");
    }
  }

  // 2) 포션 결과 한도 검사 (all-or-nothing)
  if (recipe.result.kind === "potion") {
    const have = potions[recipe.result.potionId] ?? 0;
    if (have + recipe.result.quantity > potionMax(input.potionCapacityBonus))
      throw new CraftError("potion_full");
  }

  // 3) 재료 차감
  for (const ing of recipe.ingredients) {
    if (ing.kind === "material") {
      materials[ing.materialId] = (materials[ing.materialId] ?? 0) - ing.count;
    } else {
      // 기본(equipment[]) 카운트 먼저, 모자라면 제작산 낮은 등급부터, 그래도 모자라면 드랍 고품질.
      let remaining = ing.count;
      const fromEquip = Math.min(remaining, equipment[ing.itemId] ?? 0);
      equipment[ing.itemId] = (equipment[ing.itemId] ?? 0) - fromEquip;
      remaining -= fromEquip;
      remaining = drainGraded(crafted, ing.itemId, NON_ZERO_TIERS, remaining);
      remaining = drainGraded(
        dropped,
        ing.itemId,
        NON_ZERO_DROP_QUALITIES,
        remaining,
      );
    }
  }

  // 4) 결과 적용
  let result: CraftResult;
  if (recipe.result.kind === "equipment") {
    const itemId = recipe.result.itemId;
    const tier: CraftTier = recipeHasVariance(recipe) ? rollCraftTier(rng) : 0;
    if (tier === 0) {
      equipment[itemId] = (equipment[itemId] ?? 0) + 1;
    } else {
      const tierMap = crafted[itemId] ?? {};
      const key = String(tier);
      tierMap[key] = (tierMap[key] ?? 0) + 1;
      crafted[itemId] = tierMap;
    }
    result = { kind: "equipment", itemId, tier };
  } else {
    const potionId = recipe.result.potionId;
    potions[potionId] = (potions[potionId] ?? 0) + recipe.result.quantity;
    result = { kind: "potion", potionId, quantity: recipe.result.quantity };
  }

  // 0/빈 항목 정리
  for (const k of Object.keys(materials)) if (!materials[k]) delete materials[k];
  for (const k of Object.keys(equipment)) if (!equipment[k]) delete equipment[k];
  cleanupGraded(crafted);
  cleanupGraded(dropped);

  return {
    potions,
    materials,
    equipment,
    craftedEquipment: crafted,
    droppedEquipment: dropped,
    result,
  };
}

// ─────────────────────────────────────────────────────────────────────

type SavedInventory = {
  potions?: CountMap;
  materials?: CountMap;
  equipment?: CountMap;
  craftedEquipment?: GradedMap;
  droppedEquipment?: GradedMap;
  consumables?: CountMap;
  potionCapacityBonus?: number;
  [k: string]: unknown;
};
type SavedCrafting = {
  known?: string[];
  crafted?: string[];
  [k: string]: unknown;
};

async function readKv<T>(
  tx: DbExecutor,
  userId: string,
  key: string,
): Promise<T | null> {
  const rows = await tx
    .select()
    .from(savesKv)
    .where(and(eq(savesKv.userId, userId), eq(savesKv.key, key)))
    .for("update");
  return (rows[0]?.value as T | undefined) ?? null;
}

// 트랜잭션 안에서 호출. inventory.v2 / crafting.v2 를 for-update 로 잠그고 갱신.
export async function applyCraftAction(
  tx: DbExecutor,
  userId: string,
  recipeId: string,
): Promise<CraftOutcome> {
  const inv = (await readKv<SavedInventory>(tx, userId, "inventory.v2")) ?? {};
  const craftingState =
    (await readKv<SavedCrafting>(tx, userId, "crafting.v2")) ?? {};

  const out = computeCraftOutcome(
    {
      potions: { ...(inv.potions ?? {}) },
      materials: { ...(inv.materials ?? {}) },
      equipment: { ...(inv.equipment ?? {}) },
      craftedEquipment: inv.craftedEquipment ?? {},
      droppedEquipment: inv.droppedEquipment ?? {},
      potionCapacityBonus: inv.potionCapacityBonus ?? 0,
      known: Array.isArray(craftingState.known) ? craftingState.known : [],
    },
    recipeId,
  );

  const newInventory: SavedInventory = {
    ...inv,
    potions: out.potions,
    materials: out.materials,
    equipment: out.equipment,
    craftedEquipment: out.craftedEquipment,
    droppedEquipment: out.droppedEquipment,
  };

  const craftedList = Array.isArray(craftingState.crafted)
    ? craftingState.crafted
    : [];
  const newCrafting: SavedCrafting = craftedList.includes(recipeId)
    ? craftingState
    : { ...craftingState, crafted: [...craftedList, recipeId] };

  await upsertSave(tx, userId, "inventory.v2", newInventory);
  if (newCrafting !== craftingState)
    await upsertSave(tx, userId, "crafting.v2", newCrafting);

  return { inventory: newInventory, crafting: newCrafting, result: out.result };
}
