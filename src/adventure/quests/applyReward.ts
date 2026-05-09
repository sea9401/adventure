import { ITEMS, type ItemId } from "../data/items";
import { MATERIALS, type MaterialId } from "../data/materials";
import { POTIONS, type PotionId } from "../data/potions";
import { RECIPES } from "../data/recipes";
import type { QuestReward } from "../data/quests";
import { applyNewbieBonus } from "@/lib/leveling";

export type RewardServices = {
  addPotion: (id: PotionId, count: number) => void;
  addMaterial: (id: MaterialId, count: number) => void;
  addEquipment: (id: ItemId) => void;
  learnRecipe: (id: string) => void;
  // gold/fame은 setState 1회로 처리하기 위해 묶어서 전달.
  addGoldFame: (gold: number, fame: number) => void;
  // EXP는 applyExpGain을 거쳐 레벨업까지 자동 처리되어야 한다.
  addExp: (amount: number) => void;
  addPotionCapacity: (n: number) => void;
};

export type RewardContext = {
  /** 신참 EXP ×2 보너스 판정용. 미지정 시 보너스 미적용. */
  playerLevel?: number;
};

function recipeName(id: string): string {
  return RECIPES.find((r) => r.id === id)?.name ?? id;
}

function plural(name: string, count: number): string {
  return count > 1 ? `${name} ×${count}` : name;
}

// 보상을 실제로 지급하면서, 알림에 띄울 사람이 읽기 좋은 요약 토큰을 반환.
// 호출 측에서 토큰을 콤마로 합쳐 한 줄 문구를 만든다.
export function applyQuestReward(
  reward: QuestReward,
  services: RewardServices,
  ctx: RewardContext = {},
): string[] {
  const summary: string[] = [];

  const gold = reward.gold ?? 0;
  const fame = reward.fame ?? 0;
  if (gold > 0 || fame > 0) {
    services.addGoldFame(gold, fame);
    if (gold > 0) summary.push(`골드 +${gold}`);
    if (fame > 0) summary.push(`명성 +${fame}`);
  }

  const baseExp = reward.exp ?? 0;
  if (baseExp > 0) {
    const expBonus =
      ctx.playerLevel != null
        ? applyNewbieBonus(baseExp, ctx.playerLevel)
        : { gained: baseExp, bonusApplied: false };
    services.addExp(expBonus.gained);
    summary.push(
      `EXP +${expBonus.gained}${expBonus.bonusApplied ? " (신참 ×2)" : ""}`,
    );
  }

  for (const p of reward.potions ?? []) {
    services.addPotion(p.id, p.count);
    summary.push(plural(POTIONS[p.id]?.name ?? p.id, p.count));
  }

  for (const m of reward.materials ?? []) {
    services.addMaterial(m.id, m.count);
    summary.push(plural(MATERIALS[m.id]?.name ?? m.id, m.count));
  }

  for (const it of reward.items ?? []) {
    for (let i = 0; i < it.count; i += 1) services.addEquipment(it.id);
    summary.push(plural(ITEMS[it.id]?.name ?? it.id, it.count));
  }

  for (const id of reward.recipes ?? []) {
    services.learnRecipe(id);
    summary.push(recipeName(id));
  }

  const capBonus = reward.potionCapacityBonus ?? 0;
  if (capBonus > 0) {
    services.addPotionCapacity(capBonus);
    summary.push(`포션 최대 보유량 +${capBonus}`);
  }

  return summary;
}
