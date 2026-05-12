export type PotionId = "potion_heal_s" | "potion_heal_m" | "potion_heal_l";

export type PotionEffect = {
  kind: "heal_hp";
  flat?: number;
  pct?: number;
};

export type Potion = {
  id: PotionId;
  name: string;
  description: string;
  effect: PotionEffect;
  price: number;
  /** 상점 구매 노출 여부. 미지정/true → 노출. 조합 전용 포션은 false. */
  inShop?: boolean;
};

export const POTIONS: Record<PotionId, Potion> = {
  potion_heal_s: {
    id: "potion_heal_s",
    name: "작은 회복약",
    description: "마시면 약간의 활력이 돌아온다. HP +20.",
    effect: { kind: "heal_hp", flat: 20 },
    price: 1,
  },
  potion_heal_m: {
    id: "potion_heal_m",
    name: "중간 회복약",
    description: "산초꽃을 졸여 빚은 약. 깊은 숨이 트인다. HP +50.",
    effect: { kind: "heal_hp", flat: 50 },
    price: 6,
    inShop: false,
  },
  potion_heal_l: {
    id: "potion_heal_l",
    name: "큰 회복약",
    description: "봉황 깃털을 우려낸 약. 식은 몸에 다시 불이 붙는다. HP +100.",
    effect: { kind: "heal_hp", flat: 100 },
    price: 16,
    inShop: false,
  },
};

export const POTION_IDS = Object.keys(POTIONS) as PotionId[];

// 각 포션 종류 별 최대 보유 가능 수의 기본값.
// 실제 최대값은 인벤토리에 누적된 보너스(potionCapacityBonus)를 더해 산출 — `potionMax()` 사용.
export const POTION_MAX_PER_TYPE_BASE = 10;

export function potionMax(bonus = 0): number {
  return POTION_MAX_PER_TYPE_BASE + Math.max(0, bonus);
}

export function computeHealAmount(potion: Potion, maxHp: number): number {
  const flat = potion.effect.flat ?? 0;
  const pct = potion.effect.pct ?? 0;
  return flat + Math.floor(maxHp * (pct / 100));
}
