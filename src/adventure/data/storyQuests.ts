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
  bold_slime_core: {
    id: "bold_slime_core",
    title: "슬라임 핵의 정체",
    description:
      "슬라임 핵을 본 볼드가 흥미를 보인다. 한 개 가져다 주자.",
    giverNpcId: "village_blacksmith_bold",
  },
  suzy_husband_news: {
    id: "suzy_husband_news",
    title: "남편의 소식",
    description:
      "디올라로 일하러 간 남편을 걱정하는 수지. 호숫가에서 일한다는 그를 보고 소식을 전해주자.",
    giverNpcId: "village_suzy",
  },
} as const satisfies Record<string, StoryQuest>;

export type StoryQuestId = keyof typeof STORY_QUESTS;
