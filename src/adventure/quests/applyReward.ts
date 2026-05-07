import { ITEMS, type ItemId } from "../data/items";
import { MATERIALS, type MaterialId } from "../data/materials";
import { POTIONS, type PotionId } from "../data/potions";
import { RECIPES } from "../data/recipes";
import type { QuestReward } from "../data/quests";

export type RewardServices = {
  addPotion: (id: PotionId, count: number) => void;
  addMaterial: (id: MaterialId, count: number) => void;
  addEquipment: (id: ItemId) => void;
  learnRecipe: (id: string) => void;
  // gold/fame은 setState 1회로 처리하기 위해 묶어서 전달.
  addGoldFame: (gold: number, fame: number) => void;
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
): string[] {
  const summary: string[] = [];

  const gold = reward.gold ?? 0;
  const fame = reward.fame ?? 0;
  if (gold > 0 || fame > 0) {
    services.addGoldFame(gold, fame);
    if (gold > 0) summary.push(`골드 +${gold}`);
    if (fame > 0) summary.push(`명성 +${fame}`);
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

  return summary;
}
