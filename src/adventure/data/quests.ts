import type { ItemId } from "./items";
import type { MaterialId } from "./materials";
import type { NpcId } from "./npcs";
import type { PotionId } from "./potions";
import type { RegionId } from "./world";

export type QuestRewardItem = { id: ItemId; count: number };
export type QuestRewardPotion = { id: PotionId; count: number };
export type QuestRewardMaterial = { id: MaterialId; count: number };

export type QuestReward = {
  gold?: number;
  fame?: number;
  exp?: number;
  potions?: QuestRewardPotion[];
  materials?: QuestRewardMaterial[];
  items?: QuestRewardItem[];
  recipes?: string[];
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
  // 반복 의뢰의 재수주 쿨다운(ms). 미지정 시 REPEAT_COOLDOWN_MS_DEFAULT.
  // repeatable=false 인 경우 의미 없음.
  cooldownMs?: number;
  // 설정 시 길드 게시판에 노출되지 않고 해당 NPC 대화에서만 진행.
  giverNpcId?: NpcId;
};

export const REPEAT_COOLDOWN_MS_DEFAULT = 12 * 60 * 60 * 1000;

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
  {
    id: "village-slime-extermination",
    regionId: "village",
    title: "슬라임 퇴치",
    description:
      "평야에 슬라임이 갑자기 너무 많아져서 농부들이 피해를 보고있어요. 슬라임 20마리를 처치해주세요.",
    requiredLevel: 1,
    target: { monsterName: "슬라임", count: 20 },
    reward: { gold: 6, fame: 2 },
    repeatable: true,
  },
  {
    id: "village-trainer-slimes",
    regionId: "village",
    title: "훈련 — 슬라임 5마리",
    description: "훈련 교관 스미스의 첫 과제. 평야의 슬라임 5마리를 처치한다.",
    requiredLevel: 1,
    target: { monsterName: "슬라임", count: 5 },
    reward: {
      potions: [{ id: "potion_heal_s", count: 5 }],
      recipes: ["potion_heal_s"],
    },
    repeatable: false,
    giverNpcId: "village_trainer_smith",
  },
  {
    id: "village-trainer-dogs",
    regionId: "village",
    title: "훈련 — 들개 10마리",
    description: "훈련 교관 스미스의 두 번째 과제. 들개 10마리를 처치한다.",
    requiredLevel: 1,
    target: { monsterName: "들개", count: 10 },
    reward: { exp: 10, gold: 5, fame: 1 },
    repeatable: false,
    giverNpcId: "village_trainer_smith",
  },
  {
    id: "village-trainer-moles",
    regionId: "village",
    title: "훈련 — 두더쥐 10마리",
    description: "훈련 교관 스미스의 마지막 과제. 두더쥐 10마리를 처치한다.",
    requiredLevel: 1,
    target: { monsterName: "두더쥐", count: 10 },
    reward: {
      items: [{ id: "vitality_ring", count: 1 }],
    },
    repeatable: false,
    giverNpcId: "village_trainer_smith",
  },
];

// 길드 게시판 노출용 — NPC 전속 퀘스트는 제외.
export function getQuestsForRegion(regionId: RegionId): Quest[] {
  return QUESTS.filter((q) => q.regionId === regionId && !q.giverNpcId);
}

export function getQuestById(id: string): Quest | undefined {
  return QUESTS.find((q) => q.id === id);
}
