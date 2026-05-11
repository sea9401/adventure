import { ITEMS, type EquipItem, type EquipSlot, type ItemId } from "./items";
import {
  applyCraftTier,
  craftHasVariance,
  type CraftedEquipItem,
  type CraftTier,
  type CraftVariance,
} from "./craftQuality";
import type { MaterialId } from "./materials";
import type { PotionId } from "./potions";

export type { EquipSlot } from "./items";

export type RecipeIngredient =
  | { kind: "material"; materialId: MaterialId; count: number }
  | { kind: "equip"; itemId: ItemId; count: number };

export type RecipeResult =
  | { kind: "equipment"; itemId: ItemId; slot: EquipSlot }
  | { kind: "potion"; potionId: PotionId; quantity: number };

// CraftVariance(variance / varianceTable) 를 합쳐 — 둘 다 옵셔널, equipment 결과에만 의미.
export type Recipe = CraftVariance & {
  id: string;
  name: string;
  description: string;
  ingredients: RecipeIngredient[];
  result: RecipeResult;
  /** 거래소 등록 / 우편 선물 가능 여부. 미지정/true → 가능. */
  tradable?: boolean;
};

export const RECIPES: Recipe[] = [
  {
    id: "baseball_bat",
    name: "야구 방망이 제작서",
    description: `${ITEMS.baseball_bat.name}을(를) 만든다. 손맛이 묵직하다.`,
    ingredients: [{ kind: "material", materialId: "branch", count: 2 }],
    result: { kind: "equipment", itemId: "baseball_bat", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "potion_heal_s",
    name: "작은 회복약 조합법",
    description: "슬라임 조각의 점액을 졸여 작은 회복약을 만든다.",
    ingredients: [{ kind: "material", materialId: "slime_chunk", count: 3 }],
    result: { kind: "potion", potionId: "potion_heal_s", quantity: 1 },
  },
  {
    id: "squishy_armor",
    name: "물컹물컹한 갑옷 제작법",
    description: `${ITEMS.squishy_armor.name}을(를) 만든다. 슬라임 핵을 심으로 두르고 조각을 겹겹이 다진다.`,
    ingredients: [
      { kind: "material", materialId: "slime_core", count: 1 },
      { kind: "material", materialId: "slime_chunk", count: 16 },
    ],
    result: { kind: "equipment", itemId: "squishy_armor", slot: "armor" },
    variance: { def: 1 },
  },
  {
    id: "nailed_baseball_bat",
    name: "못박힌 야구방망이 제작서",
    description: `${ITEMS.nailed_baseball_bat.name}을(를) 만든다. ${ITEMS.baseball_bat.name}에 낡은 못을 잔뜩 박아 넣는다.`,
    ingredients: [
      { kind: "equip", itemId: "baseball_bat", count: 1 },
      { kind: "material", materialId: "rusty_nail", count: 28 },
    ],
    result: {
      kind: "equipment",
      itemId: "nailed_baseball_bat",
      slot: "weapon",
    },
    variance: { atk: 1 },
  },
  {
    id: "sticky_cloak",
    name: "비단 로브 제작서",
    description: `${ITEMS.sticky_cloak.name}을(를) 만든다. 거미줄을 비단처럼 곱게 짜낸다.`,
    ingredients: [
      { kind: "material", materialId: "spider_silk", count: 7 },
      { kind: "material", materialId: "slime_chunk", count: 5 },
    ],
    result: {
      kind: "equipment",
      itemId: "sticky_cloak",
      slot: "armor",
    },
    variance: { luk: 1 },
  },
  {
    id: "bat_hood",
    name: "박쥐가죽 후드 제작서",
    description: `${ITEMS.bat_hood.name}을(를) 만든다. 박쥐 가죽을 이어 후드의 형태를 잡는다.`,
    ingredients: [
      { kind: "material", materialId: "bat_eye", count: 3 },
      { kind: "material", materialId: "wilddog_hide", count: 3 },
    ],
    result: {
      kind: "equipment",
      itemId: "bat_hood",
      slot: "armor",
    },
    variance: { spd: 1 },
  },
  {
    id: "golem_armor",
    name: "골렘갑주 제작서",
    description: `${ITEMS.golem_armor.name}을(를) 만든다. 폐허 잔해를 다듬어 거미줄로 안을 덧대고 슬라임 점액으로 이음새를 메운다.`,
    ingredients: [
      { kind: "material", materialId: "ruin_fragment", count: 7 },
      { kind: "material", materialId: "spider_silk", count: 7 },
      { kind: "material", materialId: "slime_chunk", count: 5 },
    ],
    result: {
      kind: "equipment",
      itemId: "golem_armor",
      slot: "armor",
    },
    variance: { def: 1 },
  },
  {
    id: "crystal_dagger",
    name: "수정 단검 제작서",
    description: `${ITEMS.crystal_dagger.name}을(를) 만든다. 단단한 수정을 깎아 들개 송곳니로 손잡이를 감싼다.`,
    ingredients: [
      { kind: "material", materialId: "hard_crystal", count: 3 },
      { kind: "material", materialId: "wilddog_fang", count: 4 },
    ],
    result: {
      kind: "equipment",
      itemId: "crystal_dagger",
      slot: "weapon",
    },
    variance: { atk: 1 },
  },
  {
    id: "fairy_blessing",
    name: "요정의 가호 제작서",
    description: `${ITEMS.fairy_blessing.name}을(를) 만든다. ${ITEMS.vitality_ring.name}에 요정가루를 입혀 가호를 깊게 한다.`,
    ingredients: [
      { kind: "equip", itemId: "vitality_ring", count: 1 },
      { kind: "material", materialId: "fairy_dust", count: 5 },
    ],
    result: {
      kind: "equipment",
      itemId: "fairy_blessing",
      slot: "accessory",
    },
    variance: { vit: 1 },
  },
  // 마정석 무기 4종 — 광맥의 수호자 보스 보상 라인. 마정석 ×2 + 단단한 수정 ×8 로 제작.
  // 제작 품질 등급 — 공격력 일반 +6 기준으로 ±2 변동(불량 +4 .. 걸작 +8).
  {
    id: "mana_sword",
    name: "마정석 검 제작서",
    description: `${ITEMS.mana_sword.name}을(를) 만든다. 마정석을 칼날 형태로 깎아 자루에 끼운다.`,
    ingredients: [
      { kind: "material", materialId: "mana_crystal", count: 2 },
      { kind: "material", materialId: "hard_crystal", count: 8 },
    ],
    result: { kind: "equipment", itemId: "mana_sword", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "mana_shield",
    name: "마정석 방패 제작서",
    description: `${ITEMS.mana_shield.name}을(를) 만든다. 마정석을 두텁게 다져 방패의 중심에 박아 넣는다.`,
    ingredients: [
      { kind: "material", materialId: "mana_crystal", count: 2 },
      { kind: "material", materialId: "hard_crystal", count: 8 },
    ],
    result: { kind: "equipment", itemId: "mana_shield", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "mana_spear",
    name: "마정석 창 제작서",
    description: `${ITEMS.mana_spear.name}을(를) 만든다. 마정석을 길고 가늘게 깎아 창대 끝에 박는다.`,
    ingredients: [
      { kind: "material", materialId: "mana_crystal", count: 2 },
      { kind: "material", materialId: "hard_crystal", count: 8 },
    ],
    result: { kind: "equipment", itemId: "mana_spear", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "mana_knuckle",
    name: "마정석 너클 제작서",
    description: `${ITEMS.mana_knuckle.name}을(를) 만든다. 마정석 조각을 손등 너클의 면에 박아 고정한다.`,
    ingredients: [
      { kind: "material", materialId: "mana_crystal", count: 2 },
      { kind: "material", materialId: "hard_crystal", count: 8 },
    ],
    result: { kind: "equipment", itemId: "mana_knuckle", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "mana_bracelet",
    name: "마정석 팔찌 제작서",
    description: `${ITEMS.mana_bracelet.name}을(를) 만든다. 마정석 조각을 엮어 손목에 두를 팔찌로 매만진다.`,
    ingredients: [
      { kind: "material", materialId: "mana_crystal", count: 2 },
      { kind: "material", materialId: "hard_crystal", count: 3 },
    ],
    result: { kind: "equipment", itemId: "mana_bracelet", slot: "accessory" },
    variance: { vit: 1 },
  },
  // 운봉 무기 4종 + 견갑 + 심장 — 운봉의 거인 보스 보상 라인.
  // 무기 4종 공통 재료: 거인 비늘 ×2 + 운봉석 ×3 + 단단한 수정 ×8 (호환재로 동굴 재방문 동기).
  // 제작 품질 등급 — 무기는 공격력 일반 +8 기준으로 ±2 변동(불량 +6 .. 걸작 +10).
  {
    id: "peak_sword",
    name: "운봉 대검 제작서",
    description: `${ITEMS.peak_sword.name}을(를) 만든다. 거인의 뼛조각을 운봉석으로 다져 검의 형태로 단련한다.`,
    ingredients: [
      { kind: "material", materialId: "giant_scale", count: 2 },
      { kind: "material", materialId: "unbong_ore", count: 3 },
      { kind: "material", materialId: "hard_crystal", count: 8 },
    ],
    result: { kind: "equipment", itemId: "peak_sword", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "peak_shield",
    name: "운봉 방벽 제작서",
    description: `${ITEMS.peak_shield.name}을(를) 만든다. 거인의 비늘을 운봉석으로 결합해 방패의 면을 잡는다.`,
    ingredients: [
      { kind: "material", materialId: "giant_scale", count: 2 },
      { kind: "material", materialId: "unbong_ore", count: 3 },
      { kind: "material", materialId: "hard_crystal", count: 8 },
    ],
    result: { kind: "equipment", itemId: "peak_shield", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "peak_spear",
    name: "운봉 장창 제작서",
    description: `${ITEMS.peak_spear.name}을(를) 만든다. 운봉석 끝을 길고 가늘게 깎아 창대 끝에 박는다.`,
    ingredients: [
      { kind: "material", materialId: "giant_scale", count: 2 },
      { kind: "material", materialId: "unbong_ore", count: 3 },
      { kind: "material", materialId: "hard_crystal", count: 8 },
    ],
    result: { kind: "equipment", itemId: "peak_spear", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "peak_claw",
    name: "운봉 발톱 제작서",
    description: `${ITEMS.peak_claw.name}을(를) 만든다. 거인의 손가락뼈를 깎아 운봉석을 박은 발톱으로 매만진다.`,
    ingredients: [
      { kind: "material", materialId: "giant_scale", count: 2 },
      { kind: "material", materialId: "unbong_ore", count: 3 },
      { kind: "material", materialId: "hard_crystal", count: 8 },
    ],
    result: { kind: "equipment", itemId: "peak_claw", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "peak_mantle",
    name: "운봉 견갑 제작서",
    description: `${ITEMS.peak_mantle.name}을(를) 만든다. 거인의 어깨 비늘을 운봉석으로 묶어 견갑으로 매만진다.`,
    ingredients: [
      { kind: "material", materialId: "giant_scale", count: 3 },
      { kind: "material", materialId: "unbong_ore", count: 2 },
      { kind: "material", materialId: "hard_crystal", count: 3 },
    ],
    result: { kind: "equipment", itemId: "peak_mantle", slot: "accessory" },
    variance: { dex: 1 },
  },
  {
    id: "peak_heart",
    name: "운봉의 심장 제작서",
    description: `${ITEMS.peak_heart.name}을(를) 만든다. 거인의 심장을 운봉석으로 봉인해 손에 쥘 수 있는 형태로 다진다.`,
    ingredients: [
      { kind: "material", materialId: "giant_scale", count: 2 },
      { kind: "material", materialId: "unbong_ore", count: 2 },
      { kind: "material", materialId: "hard_crystal", count: 3 },
    ],
    result: { kind: "equipment", itemId: "peak_heart", slot: "accessory" },
    variance: { str: 1 },
  },
  // 다리 구간 장비 — 운저 평원 / 잿빛 협로. 운봉 라인과 화염 라인 사이를 메운다.
  {
    id: "bison_hide_armor",
    name: "들소 가죽 갑옷 제작서",
    description: `${ITEMS.bison_hide_armor.name}을(를) 만든다. 들소 가죽을 단단한 가죽으로 안을 받쳐 여러 겹 다진다.`,
    ingredients: [
      { kind: "material", materialId: "bison_hide", count: 12 },
      { kind: "material", materialId: "tough_hide", count: 5 },
    ],
    result: { kind: "equipment", itemId: "bison_hide_armor", slot: "armor" },
    variance: { def: 1 },
  },
  {
    id: "ashforged_blade",
    name: "재무쇠 검 제작서",
    description: `${ITEMS.ashforged_blade.name}을(를) 만든다. 잿돌을 녹여 단단한 수정과 함께 벼려 칼날을 잡는다.`,
    ingredients: [
      { kind: "material", materialId: "ash_stone", count: 8 },
      { kind: "material", materialId: "hard_crystal", count: 6 },
    ],
    result: { kind: "equipment", itemId: "ashforged_blade", slot: "weapon" },
    variance: { atk: 1 },
  },
  // 봉황 무구 6종 — 화산의 심장 보스 보상 라인. 봉황령에서 모은 봉황 깃털 + 보스 드랍 재료로 벼린다.
  // 무기 공통 재료: 용암 핵 ×2 + 봉황 깃털 ×5 + 화염 비늘 ×3.
  // 제작 품질 등급 — 무기 공격력 일반 +10 기준으로 ±2 변동(불량 +8 .. 걸작 +12).
  {
    id: "volcano_sword",
    name: "봉황도 제작서",
    description: `${ITEMS.volcano_sword.name}을(를) 만든다. 용암 핵을 칼날 형태로 녹여 붓고, 봉황 깃털로 자루를 감싼다.`,
    ingredients: [
      { kind: "material", materialId: "lava_core", count: 2 },
      { kind: "material", materialId: "phoenix_feather", count: 5 },
      { kind: "material", materialId: "flame_scale", count: 3 },
    ],
    result: { kind: "equipment", itemId: "volcano_sword", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "volcano_shield",
    name: "봉황패 제작서",
    description: `${ITEMS.volcano_shield.name}을(를) 만든다. 화염 비늘을 방패 면에 겹겹이 녹여 붙이고 용암 핵으로 단련한다.`,
    ingredients: [
      { kind: "material", materialId: "lava_core", count: 2 },
      { kind: "material", materialId: "phoenix_feather", count: 5 },
      { kind: "material", materialId: "flame_scale", count: 3 },
    ],
    result: { kind: "equipment", itemId: "volcano_shield", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "volcano_spear",
    name: "봉황극 제작서",
    description: `${ITEMS.volcano_spear.name}을(를) 만든다. 용암 핵을 창끝으로 빚고, 봉황 깃털로 균형추를 달아 가볍게 한다.`,
    ingredients: [
      { kind: "material", materialId: "lava_core", count: 2 },
      { kind: "material", materialId: "phoenix_feather", count: 5 },
      { kind: "material", materialId: "flame_scale", count: 3 },
    ],
    result: { kind: "equipment", itemId: "volcano_spear", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "volcano_claw",
    name: "봉황조 제작서",
    description: `${ITEMS.volcano_claw.name}을(를) 만든다. 화산의 심장 파편을 발톱 형태로 깎아, 봉황 깃털로 손목에 고정한다.`,
    ingredients: [
      { kind: "material", materialId: "lava_core", count: 2 },
      { kind: "material", materialId: "phoenix_feather", count: 5 },
      { kind: "material", materialId: "flame_scale", count: 3 },
    ],
    result: { kind: "equipment", itemId: "volcano_claw", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "volcano_armor",
    name: "봉황갑 제작서",
    description: `${ITEMS.volcano_armor.name}을(를) 만든다. 화염 비늘을 판금처럼 두드려 용암 핵으로 이음새를 단단히 메운다.`,
    ingredients: [
      { kind: "material", materialId: "lava_core", count: 3 },
      { kind: "material", materialId: "flame_scale", count: 8 },
      { kind: "material", materialId: "phoenix_feather", count: 3 },
    ],
    result: { kind: "equipment", itemId: "volcano_armor", slot: "armor" },
    variance: { def: 1 },
  },
  {
    id: "volcano_core",
    name: "봉황주 제작서",
    description: `${ITEMS.volcano_core.name}을(를) 만든다. 화산의 심장 내부 순수 결정을 봉황 깃털로 감싸 지닐 수 있는 형태로 봉인한다.`,
    ingredients: [
      { kind: "material", materialId: "lava_core", count: 2 },
      { kind: "material", materialId: "phoenix_feather", count: 5 },
      { kind: "material", materialId: "flame_scale", count: 3 },
    ],
    result: { kind: "equipment", itemId: "volcano_core", slot: "accessory" },
    variance: { dex: 1 },
  },
];

export function getRecipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

// 결과가 그 장비인 레시피 — 제작산 등급 인스턴스를 EquipItem 으로 재구성할 때 variance 조회.
const RECIPE_BY_RESULT_ITEM: Map<ItemId, Recipe> = new Map();
for (const r of RECIPES) {
  if (r.result.kind === "equipment") RECIPE_BY_RESULT_ITEM.set(r.result.itemId, r);
}

export function getEquipmentRecipeByItemId(itemId: ItemId): Recipe | undefined {
  return RECIPE_BY_RESULT_ITEM.get(itemId);
}

// 레시피에 품질 변동 정의(variance / varianceTable)가 있는지 — 서버가 등급 추첨 여부를 결정.
export function recipeHasVariance(recipe: Recipe): boolean {
  return craftHasVariance(recipe);
}

// 제작산 등급 인스턴스(itemId + 등급) → 등급 반영된 EquipItem(+ craftTier 마커).
// 레시피가 없거나 변동 정의가 없으면 베이스 그대로(+ 마커).
export function resolveCraftedItem(
  itemId: ItemId,
  tier: CraftTier,
): CraftedEquipItem {
  const base: EquipItem = ITEMS[itemId];
  return applyCraftTier(base, RECIPE_BY_RESULT_ITEM.get(itemId) ?? {}, tier);
}
