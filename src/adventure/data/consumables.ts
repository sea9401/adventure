// 소모품 — 사용 즉시 1개씩 가방에서 빠지는 아이템. 포션과 달리 전투/회복이 아닌
// 별도 액션 (예: 마을 귀환) 효과를 가진다. 보유 한도 없음.

export type ConsumableId = "scroll_town_return";

export type ConsumableEffect = { kind: "town_return" };

export type Consumable = {
  id: ConsumableId;
  name: string;
  description: string;
  price: number;
  effect: ConsumableEffect;
};

export const CONSUMABLES: Record<ConsumableId, Consumable> = {
  scroll_town_return: {
    id: "scroll_town_return",
    name: "마을 귀환 주문서",
    description:
      "찢어 펼치면 길이 열린다 — 가본 적 있는 마을 한 곳으로 즉시 이동.",
    price: 3,
    effect: { kind: "town_return" },
  },
};

export const CONSUMABLE_IDS = Object.keys(CONSUMABLES) as ConsumableId[];
