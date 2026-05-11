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
type CraftedMap = Record<string, Record<string, number>>;

// 낮은 등급부터 소비할 때의 순서.
const NON_ZERO_TIERS = ["-2", "-1", "1", "2"] as const;

export type CraftComputeInput = {
  potions: CountMap;
  materials: CountMap;
  equipment: CountMap;
  craftedEquipment: CraftedMap;
  potionCapacityBonus: number;
  known: string[];
};

export type CraftComputeResult = {
  potions: CountMap;
  materials: CountMap;
  equipment: CountMap;
  craftedEquipment: CraftedMap;
  result: CraftResult;
};

function cloneCrafted(src: CraftedMap): CraftedMap {
  const out: CraftedMap = {};
  for (const [k, v] of Object.entries(src)) out[k] = { ...v };
  return out;
}

function craftedTotal(map: CraftedMap, itemId: string): number {
  const tiers = map[itemId];
  if (!tiers) return 0;
  let total = 0;
  for (const v of Object.values(tiers)) total += v ?? 0;
  return total;
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
  const crafted = cloneCrafted(input.craftedEquipment);

  // 1) 재료 충족 검사
  for (const ing of recipe.ingredients) {
    if (ing.kind === "material") {
      if ((materials[ing.materialId] ?? 0) < ing.count)
        throw new CraftError("missing_material");
    } else {
      const have =
        (equipment[ing.itemId] ?? 0) + craftedTotal(crafted, ing.itemId);
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
      // 무등급(equipment[]) 카운트 먼저, 모자라면 craftedEquipment 낮은 등급부터.
      let remaining = ing.count;
      const fromEquip = Math.min(remaining, equipment[ing.itemId] ?? 0);
      equipment[ing.itemId] = (equipment[ing.itemId] ?? 0) - fromEquip;
      remaining -= fromEquip;
      if (remaining > 0) {
        const tierMap = crafted[ing.itemId] ?? {};
        for (const t of NON_ZERO_TIERS) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, tierMap[t] ?? 0);
          if (take > 0) {
            tierMap[t] = (tierMap[t] ?? 0) - take;
            remaining -= take;
          }
        }
        crafted[ing.itemId] = tierMap;
      }
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
  for (const k of Object.keys(crafted)) {
    const tierMap = crafted[k];
    for (const t of Object.keys(tierMap)) if (!tierMap[t]) delete tierMap[t];
    if (Object.keys(tierMap).length === 0) delete crafted[k];
  }

  return { potions, materials, equipment, craftedEquipment: crafted, result };
}

// ─────────────────────────────────────────────────────────────────────

type SavedInventory = {
  potions?: CountMap;
  materials?: CountMap;
  equipment?: CountMap;
  craftedEquipment?: CraftedMap;
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
