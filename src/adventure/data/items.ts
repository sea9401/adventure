export type EquipSlot = "weapon" | "armor" | "accessory";

export type EquipBonus = {
  atk?: number;
  def?: number;
  str?: number;
  dex?: number;
  vit?: number;
  spd?: number;
  luk?: number;
};

export type EquipItem = {
  name: string;
  slot: EquipSlot;
  stats: { label: string; value: string }[];
  bonus?: EquipBonus;
  description?: string;
};

export const ITEMS = {
  // 시작 장비
  branch_stick: {
    name: "나무 막대",
    slot: "weapon",
    stats: [{ label: "공격력", value: "+0" }],
    bonus: { atk: 0 },
    description: "나뭇가지를 대충 다듬어 만든 평범한 막대.",
  } satisfies EquipItem,
  cloth_clothes: {
    name: "천 옷",
    slot: "armor",
    stats: [{ label: "방어력", value: "+0" }],
    bonus: { def: 0 },
    description: "평범한 천으로 만든 옷.",
  } satisfies EquipItem,
  mom_amulet: {
    name: "엄마가 준 부적",
    slot: "accessory",
    stats: [{ label: "행운", value: "+2" }],
    bonus: { luk: 2 },
    description: "어머니의 사랑이 깃든 작은 부적.",
  } satisfies EquipItem,

  // 제작·드랍 장비
  baseball_bat: {
    name: "야구 방망이",
    slot: "weapon",
    stats: [{ label: "공격력", value: "+2" }],
    bonus: { atk: 2 },
    description: "단단한 나무를 깎아 만든 묵직한 방망이.",
  } satisfies EquipItem,
  old_leather_armor: {
    name: "낡은 가죽갑옷",
    slot: "armor",
    stats: [{ label: "방어력", value: "+2" }],
    bonus: { def: 2 },
    description: "오랜 세월 입던 흔적이 남아있지만 천 옷보단 든든하다.",
  } satisfies EquipItem,
  vitality_ring: {
    name: "활력의 반지",
    slot: "accessory",
    stats: [{ label: "활력", value: "+2" }],
    bonus: { vit: 2 },
    description: "은은한 녹빛이 도는 반지. 끼고 있으면 몸이 가볍다.",
  } satisfies EquipItem,
  squishy_armor: {
    name: "물컹물컹한 갑옷",
    slot: "armor",
    stats: [{ label: "방어력", value: "+3" }],
    bonus: { def: 3 },
    description: "슬라임 핵을 심으로 두른 갑옷. 충격을 부드럽게 흡수한다.",
  } satisfies EquipItem,
} as const;

export type ItemId = keyof typeof ITEMS;

const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
const NAME_TO_ID: Map<string, ItemId> = new Map(
  ITEM_IDS.map((id) => [ITEMS[id].name, id]),
);

// 장착돼 있던 EquipItem이 어느 ITEMS 엔트리인지 역추적. localStorage 저장 후
// 참조가 끊긴 인스턴스도 이름 매칭으로 식별 — 이름은 고유라고 가정.
export function findItemId(item: EquipItem | null | undefined): ItemId | null {
  if (!item) return null;
  return NAME_TO_ID.get(item.name) ?? null;
}
