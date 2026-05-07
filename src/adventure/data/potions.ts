export type PotionId = "potion_heal_s";

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
};

export const POTIONS: Record<PotionId, Potion> = {
  potion_heal_s: {
    id: "potion_heal_s",
    name: "작은 회복약",
    description: "마시면 약간의 활력이 돌아온다. HP +20.",
    effect: { kind: "heal_hp", flat: 20 },
    price: 1,
  },
};

export const POTION_IDS = Object.keys(POTIONS) as PotionId[];

export function computeHealAmount(potion: Potion, maxHp: number): number {
  const flat = potion.effect.flat ?? 0;
  const pct = potion.effect.pct ?? 0;
  return flat + Math.floor(maxHp * (pct / 100));
}
