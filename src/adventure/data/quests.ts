import type { RegionId } from "./world";

export type QuestReward = {
  gold: number;
  fame: number;
};

export type Quest = {
  id: string;
  regionId: RegionId;
  title: string;
  description: string;
  requiredLevel: number;
  target: { monsterName: string; count: number };
  reward: QuestReward;
  repeatable: boolean;
};

export const QUESTS: Quest[] = [
  {
    id: "village-beggars",
    regionId: "village",
    title: "마을의 거지들",
    description:
      "마을에 주정뱅이가 너무 많다는 민원이 들어오고있어요. 주정뱅이 10명을 혼내주세요.",
    requiredLevel: 1,
    target: { monsterName: "주정뱅이", count: 10 },
    reward: { gold: 3, fame: 1 },
    repeatable: true,
  },
];

export function getQuestsForRegion(regionId: RegionId): Quest[] {
  return QUESTS.filter((q) => q.regionId === regionId);
}

export function getQuestById(id: string): Quest | undefined {
  return QUESTS.find((q) => q.id === id);
}
