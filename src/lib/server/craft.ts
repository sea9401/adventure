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
import {
  CRAFT_BATCH_MAX,
  type CraftOutcome,
  type CraftResult,
} from "@/adventure/crafting/types";

export type { CraftOutcome, CraftResult };

// 호출부(route)가 HTTP 400 으로 매핑 — 모두 "요청이 게임 규칙 위반" 케이스.
export class CraftError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "CraftError";
  }
}

// 가루 공정 3 종은 모든 모험가가 기본으로 아는 공정 — 클라이언트의 useCrafting 도
// readInitial 에서 known 에 자동 보강한다. 서버도 동일하게 보강해 영속 상태가 아직
// 보강 전인 레거시 세이브가 "not_learned" 로 거절되지 않게 한다.
const AUTO_KNOWN_DUST_RECIPES: readonly string[] = [
  "potion_heal_s_dust",
  "potion_heal_m_dust",
  "potion_heal_l_dust",
];

function withAutoKnownDustRecipes(known: readonly string[]): string[] {
  const out = [...known];
  for (const id of AUTO_KNOWN_DUST_RECIPES) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
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
  // 배치 제작 시 호출 수량만큼 채워지고 단일 제작이면 길이 1. 등급 추첨은 회마다 독립.
  results: CraftResult[];
};

export type CraftComputeOptions = {
  /** 한 번에 만들 수량(1 ≤ q ≤ CRAFT_BATCH_MAX). 미지정 = 1. */
  quantity?: number;
  /** 등급 추첨 RNG 주입(테스트용). 미지정 = Math.random. */
  rng?: () => number;
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

// 순수 함수 — savesKv 읽은 값으로 새 상태 + results 를 계산. 위반 시 CraftError.
// quantity 는 1 이상 CRAFT_BATCH_MAX 이하 정수. 재료/포션 한도는 quantity 배로 한 번에 검사하고
// 만족 못 하면 즉시 throw (all-or-nothing). 만족하면 재료를 quantity 배 차감하고 결과는 N 회
// 적용한다. 등급 변동 레시피는 매 회 rollCraftTier 를 다시 굴리므로 results 안에 서로 다른 tier
// 가 섞일 수 있다 — 클라가 results 를 그대로 알림에 풀어 "걸작/일반/불량" 을 개별로 보여 준다.
export function computeCraftOutcome(
  input: CraftComputeInput,
  recipeId: string,
  options: CraftComputeOptions = {},
): CraftComputeResult {
  const quantity = options.quantity ?? 1;
  const rng = options.rng ?? Math.random;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > CRAFT_BATCH_MAX) {
    throw new CraftError("invalid_quantity");
  }

  const recipe = getRecipeById(recipeId);
  if (!recipe) throw new CraftError("unknown_recipe");
  if (!input.known.includes(recipe.id)) throw new CraftError("not_learned");

  const potions = { ...input.potions };
  const materials = { ...input.materials };
  const equipment = { ...input.equipment };
  const crafted = cloneGraded(input.craftedEquipment);
  const dropped = cloneGraded(input.droppedEquipment ?? {});

  // 1) 재료 충족 검사 — quantity 배.
  for (const ing of recipe.ingredients) {
    const need = ing.count * quantity;
    if (ing.kind === "material") {
      if ((materials[ing.materialId] ?? 0) < need)
        throw new CraftError("missing_material");
    } else {
      const have =
        (equipment[ing.itemId] ?? 0) +
        gradedTotal(crafted, ing.itemId) +
        gradedTotal(dropped, ing.itemId);
      if (have < need) throw new CraftError("missing_ingredient");
    }
  }

  // 2) 포션 결과 한도 검사 (all-or-nothing, quantity 배 생산 기준)
  if (recipe.result.kind === "potion") {
    const have = potions[recipe.result.potionId] ?? 0;
    const totalProduce = recipe.result.quantity * quantity;
    if (have + totalProduce > potionMax(input.potionCapacityBonus))
      throw new CraftError("potion_full");
  }

  // 3) 재료 차감 — quantity 배.
  for (const ing of recipe.ingredients) {
    const need = ing.count * quantity;
    if (ing.kind === "material") {
      materials[ing.materialId] = (materials[ing.materialId] ?? 0) - need;
    } else {
      // 기본(equipment[]) 카운트 먼저, 모자라면 제작산 낮은 등급부터, 그래도 모자라면 드랍 고품질.
      let remaining = need;
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

  // 4) 결과 적용 — quantity 회. 등급은 매 회 독립 추첨.
  const results: CraftResult[] = [];
  for (let i = 0; i < quantity; i++) {
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
      results.push({ kind: "equipment", itemId, tier });
    } else {
      const potionId = recipe.result.potionId;
      potions[potionId] = (potions[potionId] ?? 0) + recipe.result.quantity;
      results.push({
        kind: "potion",
        potionId,
        quantity: recipe.result.quantity,
      });
    }
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
    results,
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
  quantity: number = 1,
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
      // 가루 공정 3 종은 기본기 — 서버 권위 검증에서도 자동 학습으로 본다
      // (클라이언트는 useCrafting.readInitial 가 known 에 보강. 영속 상태가
      //  아직 보강 전이라도 서버가 거절하지 않도록 한다.)
      known: withAutoKnownDustRecipes(
        Array.isArray(craftingState.known) ? craftingState.known : [],
      ),
    },
    recipeId,
    { quantity },
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

  return { inventory: newInventory, crafting: newCrafting, results: out.results };
}
