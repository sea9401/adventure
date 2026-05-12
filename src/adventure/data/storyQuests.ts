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
  // 볼드 ↔ 만월 — 두 대장장이의 재회(§7.1). 의뢰 없이 대사 릴레이.
  // 가드 flag: manwol_bold_errand_given → manwol_bold_letter_delivered → manwol_bold_reunion_done.
  // 만월의 운봉석 시연(`unhyang-manwol-ore-demo`) 완료 후 만월이 손잡이를 맡긴다.
  manwol_bold_reunion: {
    id: "manwol_bold_reunion",
    title: "두 대장장이",
    description:
      "운향 대장장이 만월이 시작 마을의 옛 동료 볼드에게 손잡이 하나를 전해 달라고 한다. 볼드에게 갔다가, 다시 만월에게 돌아오자.",
    giverNpcId: "unhyang_smith",
  },
  // 운향 순례자 미상 — "북쪽 너머" 미스터리. 의뢰 없이 대사 분기로만 진행 (PilgrimDialogue).
  // 진행 가드는 storyFlag: volcano_heart_defeated → skyreach_main_cleared → pilgrim_revealed.
  pilgrim_beyond_north: {
    id: "pilgrim_beyond_north",
    title: "북쪽 너머",
    description:
      "북쪽에서 왔다는 순례자. 화산의 심장을 잠재우고, 천공 성지의 봉인까지 완성하면 — 그가 자기가 온 곳을 한 겹씩 열어 보인다.",
    giverNpcId: "unhyang_pilgrim",
  },
} as const satisfies Record<string, StoryQuest>;

export type StoryQuestId = keyof typeof STORY_QUESTS;
