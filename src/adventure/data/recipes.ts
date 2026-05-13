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
    id: "potion_heal_m",
    name: "중간 회복약 조합법",
    description:
      "산초꽃을 약불에 졸여 중간 회복약을 만든다. 운향 일대에서 산초꽃을 모아야 한다.",
    ingredients: [{ kind: "material", materialId: "sancho_blossom", count: 3 }],
    result: { kind: "potion", potionId: "potion_heal_m", quantity: 1 },
  },
  {
    id: "potion_heal_l",
    name: "큰 회복약 조합법",
    description:
      "봉황 깃털을 우려내 큰 회복약을 만든다. 봉황령에서 깃털을 모아야 한다.",
    ingredients: [{ kind: "material", materialId: "phoenix_feather", count: 2 }],
    result: { kind: "potion", potionId: "potion_heal_l", quantity: 1 },
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

  // ── 중간 단계 제작 라인 — 그동안 퀘스트/판매 외엔 안 쓰이던 재료에 제작 destination 부여 ──
  {
    id: "soul_blade",
    name: "혼백검 제작서",
    description: `${ITEMS.soul_blade.name}을(를) 만든다. 영혼 결정을 칼날 안에 가두고 폐허 잔해로 자루를 다진다.`,
    ingredients: [
      { kind: "material", materialId: "soul_crystal", count: 2 },
      { kind: "material", materialId: "ruin_fragment", count: 3 },
      { kind: "material", materialId: "hard_crystal", count: 3 },
    ],
    result: { kind: "equipment", itemId: "soul_blade", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "sancho_vest",
    name: "산초 누비 조끼 제작법",
    description: `${ITEMS.sancho_vest.name}을(를) 만든다. 말린 산초꽃을 천 사이에 누벼 넣고 단단한 가죽으로 테를 두른다.`,
    ingredients: [
      { kind: "material", materialId: "sancho_blossom", count: 4 },
      { kind: "material", materialId: "tough_hide", count: 3 },
      { kind: "material", materialId: "slime_chunk", count: 8 },
    ],
    result: { kind: "equipment", itemId: "sancho_vest", slot: "armor" },
    variance: { def: 1 },
  },
  {
    id: "windmana_charm",
    name: "바람 마석 부적 세공법",
    description: `${ITEMS.windmana_charm.name}을(를) 만든다. 바람 마석을 가는 끈에 꿰고 요정가루로 봉한다.`,
    ingredients: [
      { kind: "material", materialId: "wind_mana_stone", count: 3 },
      { kind: "material", materialId: "fairy_dust", count: 3 },
      { kind: "material", materialId: "spider_silk", count: 4 },
    ],
    result: { kind: "equipment", itemId: "windmana_charm", slot: "accessory" },
    variance: { spd: 1 },
  },
  {
    id: "wolfking_fang_dagger",
    name: "늑대왕 송곳니 단검 제작서",
    description: `${ITEMS.wolfking_fang_dagger.name}을(를) 만든다. 무리장의 송곳니를 자루에 박고 들개 송곳니로 날을 세운다.`,
    ingredients: [
      { kind: "material", materialId: "wolf_king_fang", count: 1 },
      { kind: "material", materialId: "wilddog_fang", count: 6 },
      { kind: "material", materialId: "tough_hide", count: 4 },
    ],
    result: { kind: "equipment", itemId: "wolfking_fang_dagger", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "hawkfeather_cloak",
    name: "매깃 망토 직조법",
    description: `${ITEMS.hawkfeather_cloak.name}을(를) 만든다. 초원 매 깃털을 들소 가죽 테에 한 장씩 이어 짠다.`,
    ingredients: [
      { kind: "material", materialId: "hawk_feather", count: 5 },
      { kind: "material", materialId: "bison_hide", count: 3 },
      { kind: "material", materialId: "spider_silk", count: 6 },
    ],
    result: { kind: "equipment", itemId: "hawkfeather_cloak", slot: "armor" },
    variance: { spd: 1 },
  },

  // ── 기존 장비 → 한 단계 위 장비 업그레이드 라인 (베이스를 'equip' 재료로 소비) ──
  // 베이스 1개 + 같은 구간 재료를 들여 같은 한 자루를 끌어올린다. nailed_baseball_bat / fairy_blessing 와 같은 방식.
  // 명품(unique) 업그레이드는 결과도 unique·비거래 — "손에 맞춰진 보물".
  {
    id: "reinforced_leather_armor",
    name: "덧댄 가죽갑옷 제작법",
    description: `${ITEMS.reinforced_leather_armor.name}을(를) 만든다. ${ITEMS.old_leather_armor.name}에 들개 가죽을 덧대 두텁게 누빈다.`,
    ingredients: [
      { kind: "equip", itemId: "old_leather_armor", count: 1 },
      { kind: "material", materialId: "wilddog_hide", count: 8 },
    ],
    result: { kind: "equipment", itemId: "reinforced_leather_armor", slot: "armor" },
    variance: { def: 1 },
  },
  {
    id: "bandit_chief_dagger",
    name: "두목의 단검 제작서",
    description: `${ITEMS.bandit_chief_dagger.name}을(를) 만든다. ${ITEMS.bandit_dagger.name}에 단단한 수정을 박아 날을 다시 세운다.`,
    ingredients: [
      { kind: "equip", itemId: "bandit_dagger", count: 1 },
      { kind: "material", materialId: "hard_crystal", count: 6 },
    ],
    result: { kind: "equipment", itemId: "bandit_chief_dagger", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "nymph_blessing",
    name: "호수 님프의 가호 제작서",
    description: `${ITEMS.nymph_blessing.name}을(를) 만든다. ${ITEMS.nymph_ring.name}에 요정가루를 입혀 가호를 깊게 한다.`,
    ingredients: [
      { kind: "equip", itemId: "nymph_ring", count: 1 },
      { kind: "material", materialId: "fairy_dust", count: 5 },
    ],
    result: { kind: "equipment", itemId: "nymph_blessing", slot: "accessory" },
    variance: { spd: 1 },
  },
  {
    id: "reforged_golem_hammer",
    name: "재단조한 골렘 망치 제작서",
    description: `${ITEMS.reforged_golem_hammer.name}을(를) 만든다. ${ITEMS.golem_hammer.name}을(를) 마정석으로 다시 벼리고 폐허 잔해로 자루를 보강한다.`,
    ingredients: [
      { kind: "equip", itemId: "golem_hammer", count: 1 },
      { kind: "material", materialId: "mana_crystal", count: 8 },
      { kind: "material", materialId: "ruin_fragment", count: 8 },
    ],
    result: { kind: "equipment", itemId: "reforged_golem_hammer", slot: "weapon" },
    variance: { atk: 1 },
  },
  {
    id: "wraithking_cloak",
    name: "망령왕의 망토 제작서",
    description: `${ITEMS.wraithking_cloak.name}을(를) 만든다. ${ITEMS.wraith_cloak.name}에 영혼 결정을 엮어 넣어 한기를 깊게 한다.`,
    ingredients: [
      { kind: "equip", itemId: "wraith_cloak", count: 1 },
      { kind: "material", materialId: "soul_crystal", count: 10 },
    ],
    result: { kind: "equipment", itemId: "wraithking_cloak", slot: "armor" },
    variance: { def: 1 },
  },
  {
    id: "lava_core_greatmaul",
    name: "용암핵 대망치 단조서",
    description: `${ITEMS.lava_core_greatmaul.name}을(를) 만든다. ${ITEMS.lava_core_maul.name}에 용암 핵을 더 녹여 붓고 화염 비늘로 자루를 감싼다.`,
    ingredients: [
      { kind: "equip", itemId: "lava_core_maul", count: 1 },
      { kind: "material", materialId: "lava_core", count: 12 },
      { kind: "material", materialId: "flame_scale", count: 8 },
    ],
    result: { kind: "equipment", itemId: "lava_core_greatmaul", slot: "weapon" },
    variance: { atk: 1 },
    tradable: false,
  },
  {
    id: "azure_talon",
    name: "창천의 발톱 세공서",
    description: `${ITEMS.azure_talon.name}을(를) 만든다. ${ITEMS.sky_render_talon.name}에 초원 매 깃털을 겹겹이 둘러 균형을 잡는다.`,
    ingredients: [
      { kind: "equip", itemId: "sky_render_talon", count: 1 },
      { kind: "material", materialId: "hawk_feather", count: 16 },
    ],
    result: { kind: "equipment", itemId: "azure_talon", slot: "weapon" },
    variance: { atk: 1 },
    tradable: false,
  },
  {
    id: "spider_queen_silk_plate",
    name: "거미여왕의 비단 정갑 직조서",
    description: `${ITEMS.spider_queen_silk_plate.name}을(를) 만든다. ${ITEMS.spider_queen_silk_robe.name}을(를) 거미줄로 더 곱게 짜 올린다.`,
    ingredients: [
      { kind: "equip", itemId: "spider_queen_silk_robe", count: 1 },
      { kind: "material", materialId: "spider_silk", count: 24 },
    ],
    result: { kind: "equipment", itemId: "spider_queen_silk_plate", slot: "armor" },
    variance: { luk: 1 },
    tradable: false,
  },
  {
    id: "bat_swarm_guide",
    name: "박쥐떼의 인도자 세공서",
    description: `${ITEMS.bat_swarm_guide.name}을(를) 만든다. ${ITEMS.bat_swarm_charm.name}에 박쥐 눈알을 박아 어둠을 더 멀리 읽게 한다.`,
    ingredients: [
      { kind: "equip", itemId: "bat_swarm_charm", count: 1 },
      { kind: "material", materialId: "bat_eye", count: 16 },
    ],
    result: { kind: "equipment", itemId: "bat_swarm_guide", slot: "accessory" },
    variance: { spd: 1 },
    tradable: false,
  },
  {
    id: "phoenix_flight_cape",
    name: "봉황 비행깃 망토 직조서",
    description: `${ITEMS.phoenix_flight_cape.name}을(를) 만든다. ${ITEMS.flame_eagle_cape.name}에 봉황 깃털을 더 이어 짜 비행깃을 살린다.`,
    ingredients: [
      { kind: "equip", itemId: "flame_eagle_cape", count: 1 },
      { kind: "material", materialId: "phoenix_feather", count: 10 },
    ],
    result: { kind: "equipment", itemId: "phoenix_flight_cape", slot: "armor" },
    variance: { spd: 1 },
  },
  {
    id: "mole_king_borer",
    name: "두더지왕의 굴착드릴 개조서",
    description: `${ITEMS.mole_king_borer.name}을(를) 만든다. ${ITEMS.mole_king_drill.name}에 단단한 수정 날과 마정석 동력부를 단다.`,
    ingredients: [
      { kind: "equip", itemId: "mole_king_drill", count: 1 },
      { kind: "material", materialId: "hard_crystal", count: 20 },
      { kind: "material", materialId: "mana_crystal", count: 10 },
    ],
    result: { kind: "equipment", itemId: "mole_king_borer", slot: "weapon" },
    variance: { atk: 1 },
    tradable: false,
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
