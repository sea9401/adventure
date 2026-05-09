import { ITEMS, type EquipSlot, type ItemId } from "./items";
import type { MaterialId } from "./materials";
import type { PotionId } from "./potions";

export type { EquipSlot } from "./items";

export type RecipeIngredient =
  | { kind: "material"; materialId: MaterialId; count: number }
  | { kind: "equip"; itemId: ItemId; count: number };

export type RecipeResult =
  | { kind: "equipment"; itemId: ItemId; slot: EquipSlot }
  | { kind: "potion"; potionId: PotionId; quantity: number };

export type Recipe = {
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
    ingredients: [{ kind: "material", materialId: "branch", count: 1 }],
    result: { kind: "equipment", itemId: "baseball_bat", slot: "weapon" },
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
      { kind: "material", materialId: "slime_chunk", count: 10 },
    ],
    result: { kind: "equipment", itemId: "squishy_armor", slot: "armor" },
  },
  {
    id: "nailed_baseball_bat",
    name: "못박힌 야구방망이 제작서",
    description: `${ITEMS.nailed_baseball_bat.name}을(를) 만든다. ${ITEMS.baseball_bat.name}에 낡은 못을 잔뜩 박아 넣는다.`,
    ingredients: [
      { kind: "equip", itemId: "baseball_bat", count: 1 },
      { kind: "material", materialId: "rusty_nail", count: 20 },
    ],
    result: {
      kind: "equipment",
      itemId: "nailed_baseball_bat",
      slot: "weapon",
    },
  },
  {
    id: "sticky_cloak",
    name: "비단 로브 제작서",
    description: `${ITEMS.sticky_cloak.name}을(를) 만든다. 거미줄을 비단처럼 곱게 짜낸다.`,
    ingredients: [
      { kind: "material", materialId: "spider_silk", count: 5 },
      { kind: "material", materialId: "slime_chunk", count: 3 },
    ],
    result: {
      kind: "equipment",
      itemId: "sticky_cloak",
      slot: "armor",
    },
  },
  {
    id: "bat_hood",
    name: "박쥐가죽 후드 제작서",
    description: `${ITEMS.bat_hood.name}을(를) 만든다. 박쥐 가죽을 이어 후드의 형태를 잡는다.`,
    ingredients: [
      { kind: "material", materialId: "bat_eye", count: 2 },
      { kind: "material", materialId: "wilddog_hide", count: 2 },
    ],
    result: {
      kind: "equipment",
      itemId: "bat_hood",
      slot: "armor",
    },
  },
  {
    id: "golem_armor",
    name: "골렘갑주 제작서",
    description: `${ITEMS.golem_armor.name}을(를) 만든다. 폐허 잔해를 다듬어 거미줄로 안을 덧대고 슬라임 점액으로 이음새를 메운다.`,
    ingredients: [
      { kind: "material", materialId: "ruin_fragment", count: 5 },
      { kind: "material", materialId: "spider_silk", count: 5 },
      { kind: "material", materialId: "slime_chunk", count: 3 },
    ],
    result: {
      kind: "equipment",
      itemId: "golem_armor",
      slot: "armor",
    },
  },
  {
    id: "crystal_dagger",
    name: "수정 단검 제작서",
    description: `${ITEMS.crystal_dagger.name}을(를) 만든다. 단단한 수정을 깎아 들개 송곳니로 손잡이를 감싼다.`,
    ingredients: [
      { kind: "material", materialId: "hard_crystal", count: 2 },
      { kind: "material", materialId: "wilddog_fang", count: 3 },
    ],
    result: {
      kind: "equipment",
      itemId: "crystal_dagger",
      slot: "weapon",
    },
  },
  {
    id: "fairy_blessing",
    name: "요정의 가호 제작서",
    description: `${ITEMS.fairy_blessing.name}을(를) 만든다. ${ITEMS.vitality_ring.name}에 요정가루를 입혀 가호를 깊게 한다.`,
    ingredients: [
      { kind: "equip", itemId: "vitality_ring", count: 1 },
      { kind: "material", materialId: "fairy_dust", count: 3 },
    ],
    result: {
      kind: "equipment",
      itemId: "fairy_blessing",
      slot: "accessory",
    },
  },
  // 마정석 무기 4종 — 광맥의 수호자 보스 보상 라인. 모두 마정석 ×3 으로 제작.
  {
    id: "mana_sword",
    name: "마정석 검 제작서",
    description: `${ITEMS.mana_sword.name}을(를) 만든다. 마정석을 칼날 형태로 깎아 자루에 끼운다.`,
    ingredients: [{ kind: "material", materialId: "mana_crystal", count: 3 }],
    result: { kind: "equipment", itemId: "mana_sword", slot: "weapon" },
  },
  {
    id: "mana_shield",
    name: "마정석 방패 제작서",
    description: `${ITEMS.mana_shield.name}을(를) 만든다. 마정석을 두텁게 다져 방패의 중심에 박아 넣는다.`,
    ingredients: [{ kind: "material", materialId: "mana_crystal", count: 3 }],
    result: { kind: "equipment", itemId: "mana_shield", slot: "weapon" },
  },
  {
    id: "mana_spear",
    name: "마정석 창 제작서",
    description: `${ITEMS.mana_spear.name}을(를) 만든다. 마정석을 길고 가늘게 깎아 창대 끝에 박는다.`,
    ingredients: [{ kind: "material", materialId: "mana_crystal", count: 3 }],
    result: { kind: "equipment", itemId: "mana_spear", slot: "weapon" },
  },
  {
    id: "mana_knuckle",
    name: "마정석 너클 제작서",
    description: `${ITEMS.mana_knuckle.name}을(를) 만든다. 마정석 조각을 손등 너클의 면에 박아 고정한다.`,
    ingredients: [{ kind: "material", materialId: "mana_crystal", count: 3 }],
    result: { kind: "equipment", itemId: "mana_knuckle", slot: "weapon" },
  },
];

export function getRecipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}
