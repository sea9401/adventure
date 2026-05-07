// 멀티스테이지 NPC 스토리 퀘스트 — 기존 monster-kill 의뢰(`quests.ts`)와 분리.
// 진행 상태는 각 시스템이 내부적으로 보존(예: crafting 상태)하고, 여기서는 메타데이터만 정의.

export type StoryQuest = {
  id: string;
  title: string;
  description: string;
  giverNpcId: string;
};

export const STORY_QUESTS = {
  bold_blacksmith_intro: {
    id: "bold_blacksmith_intro",
    title: "대장간 입문",
    description:
      "대장장이 볼드의 권유로 야구 방망이를 직접 제작해 보자.",
    giverNpcId: "village_blacksmith_bold",
  },
} as const satisfies Record<string, StoryQuest>;

export type StoryQuestId = keyof typeof STORY_QUESTS;
