"use client";

import {
  applyQuestReward,
  type RewardServices,
} from "@/adventure/quests/applyReward";
import { applyQuestCompletionSideEffects } from "@/adventure/quests/questCompletionSideEffects";
import type { Character } from "@/adventure/character/types";
import type { useCharacterState } from "@/adventure/character/useCharacterState";
import type { useParagonState } from "@/adventure/character/useParagonState";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import type { GuildBuffSlot } from "@/adventure/data/guildBuffs";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";
import { computeParagonBonus } from "@/lib/paragon";

// 퀘스트 수락/보상 지급 핸들러 묶음 — NPC 다이얼로그·길드 게시판 공용.
// grantTitle 은 page.tsx 초기에 useTitleGrant 로 만들어 넘긴다 (character 합성 전에도 쓰여서).
export function useQuestActions(deps: {
  quests: ReturnType<typeof useQuests>;
  crafting: ReturnType<typeof useCrafting>;
  inventory: ReturnType<typeof useInventory>;
  characterStateHook: ReturnType<typeof useCharacterState>;
  paragon: ReturnType<typeof useParagonState>;
  storyFlags: ReturnType<typeof useStoryFlags>;
  guildBuffs: GuildBuffSlot[];
  character: Character;
  grantTitle: (titleId: string) => void;
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
}) {
  const {
    quests,
    crafting,
    inventory,
    characterStateHook,
    paragon,
    storyFlags,
    guildBuffs,
    character,
    grantTitle,
    addNotification,
  } = deps;

  const handleAcceptQuest = (id: string) => {
    quests.accept(id);
  };

  const rewardServices: RewardServices = {
    addPotion: (id, n) => inventory.add(id, n),
    addMaterial: (id, n) => inventory.addMaterial(id, n),
    addEquipment: (id) => inventory.addEquipment(id),
    learnRecipe: (id) => crafting.learnRecipe(id),
    addGoldFame: characterStateHook.addGoldFame,
    // 퀘스트 보상으로 레벨업 시에도 VIT 보너스만큼 maxHp 까지 풀회복.
    addExp: (n) => characterStateHook.addExp(n, character.stats.vit),
    addPotionCapacity: (n) => inventory.addPotionCapacity(n),
    addSkillBook: (id, n) => inventory.addSkillBook(id, n),
  };

  // 퀘스트 보상 지급 + 알림 한 줄로 합성. NPC 다이얼로그/길드 게시판 공용.
  const completeQuest = (id: string): boolean => {
    const result = quests.claim(id);
    if (!result.ok) return false;
    const tokens = applyQuestReward(result.quest.reward, rewardServices, {
      playerLevel: character.level,
      guildBuffs,
      paragonBonus: computeParagonBonus(paragon.state.allocations),
    });
    addNotification(
      "quest_complete",
      tokens.length > 0
        ? `${result.quest.title} 완료 — ${tokens.join(", ")}`
        : `${result.quest.title} 완료`,
    );
    // 라인 클로저 후처리 — 의뢰별 칭호 부여 + 스토리 flag.
    applyQuestCompletionSideEffects(id, { grantTitle, storyFlags, quests });
    return true;
  };

  const handleClaimQuest = (id: string) => {
    completeQuest(id);
  };

  return { handleAcceptQuest, completeQuest, handleClaimQuest };
}
