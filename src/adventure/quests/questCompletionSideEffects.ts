import type { useQuests } from "@/adventure/quests/useQuests";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import {
  QUEST_COMPLETION_DIRECT,
  QUEST_COMPLETION_GROUPS,
  type QuestSideEffect,
} from "./questCompletionData";

// completeQuest 의 클라 측 후처리 — 데이터(QUEST_COMPLETION_DIRECT/GROUPS) 는
// 서버와 공용이지만, hook 호출로의 매핑은 클라에서만. 서버는 같은 데이터를
// 직접 saves 에 mutate.

export function applyQuestCompletionSideEffects(
  id: string,
  deps: {
    grantTitle: (titleId: string) => void;
    storyFlags: ReturnType<typeof useStoryFlags>;
    quests: ReturnType<typeof useQuests>;
  },
): void {
  const { grantTitle, storyFlags, quests } = deps;

  const apply = (effects: readonly QuestSideEffect[]) => {
    for (const e of effects) {
      if (e.kind === "grantTitle") grantTitle(e.titleId);
      else storyFlags.set(e.flag);
    }
  };

  const direct = QUEST_COMPLETION_DIRECT[id];
  if (direct) apply(direct);

  for (const group of QUEST_COMPLETION_GROUPS) {
    if (!group.members.includes(id)) continue;
    const others = group.members.filter((m) => m !== id);
    if (others.every((m) => quests.getEntry(m).state === "completed")) {
      apply(group.effects);
    }
  }
}
