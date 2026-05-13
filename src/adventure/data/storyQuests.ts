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
  // 히든 — 유실품을 모으는 자의 옛 노래(§11). 바람골 음유시인이 인벤을 보고 행운을 점친다.
  // 가드: 보유 unique 등급 장비 ≥ 2 종 + 음유시인 대화 → lucky_finder 칭호 (flag bard_lucky_collected).
  hidden_lucky_collector: {
    id: "hidden_lucky_collector",
    title: "운 좋은 손",
    description:
      "바람골 음유시인이 부르는 옛 노래 — 유실된 명품을 둘 이상 그러모은 자에게 행운이 따라붙는다고.",
    giverNpcId: "windvale_bard",
  },
  // 히든 — 후드 손님 ↔ 순례자의 표식(§11). 두 미스터리 NPC 가 같은 조직임이 드러난다.
  // 가드 flag: cipher_started(후드 손님) → cipher_shown_pilgrim(순례자) → cipher_done(후드 손님).
  hidden_hooded_cipher: {
    id: "hidden_hooded_cipher",
    title: "표식",
    description:
      "디올라 후드 손님이 건넨 표식을, 운향 순례자에게 보여주면 — 같은 손이 그은 것임을 둘 다 안다.",
    giverNpcId: "diola_stranger",
  },
  // 히든 — 순례자의 자취(§11.1). 운향 메인 완료 후, 순례자가 운저 평원→잿빛 협로→봉황령에 남긴
  // 표식을 따라가 천공 성지에서 재회. 4단계: trail-1/2/3 (각 지역에서 PilgrimMarkDialogue 로 surfacing)
  // → 4단계는 trail-3 완료 + skyreach 도착 시 PilgrimMarkDialogue 가 재회 처리 → pilgrim_revealed flag.
  hidden_pilgrim_trail: {
    id: "hidden_pilgrim_trail",
    title: "순례자의 자취",
    description:
      "운향을 떠난 순례자가 길마다 남긴 매듭 표식 — 운저 평원, 잿빛 협로, 봉황령을 거쳐 천공 성지까지. 끝까지 따라가면 그가 처음으로 '북쪽 너머'를 말한다.",
    giverNpcId: "unhyang_pilgrim",
  },
  // 부러진 영웅검 복원 — 폐허 늑대 드랍 unique `hero_broken_sword` 윗동강을 운향 만월이
  // 운봉석 검신 + 화염 능선 재료 날밑으로 한 자루로 되살린다. 만월 재회 라인(manwol_bold_reunion_done)
  // + 천공 성지 보스(volcano_heart_defeated) 이후 해금. 가드 flag 릴레이:
  // hero_sword_started → hero_sword_ore_done → hero_sword_core_done → hero_sword_forging → hero_sword_restored.
  // 완성 시 `hero_sword`(legendary, atk +16 / spd -1) + 칭호 hero_sword_heir.
  hero_sword_restoration: {
    id: "hero_sword_restoration",
    title: "부러진 영웅검",
    description:
      "폐허에서 주운 부러진 영웅검의 윗동강. 산정의 대장장이 만월이라면 — 운봉석으로 검신을 잇고, 날밑을 새로 둘러 한 자루로 되살릴 수 있을지도.",
    giverNpcId: "unhyang_smith",
  },
  // 해안 지선 메인 — 소만 원로 여울. 갯벌 의뢰로 소만 신임(saltmarsh_vouched) → 뱃사공 해랑
  // 선저 덧대기(ferryman_reef_passage) → 암초 정찰 → 수심의 것 처치(the_deep_one_stilled).
  // 진행은 quests.ts(saltmarsh-yeoul-*) + YeoulDialogue/HaerangDialogue 의 storyFlag 분기로.
  saltmarsh_deep_one: {
    id: "saltmarsh_deep_one",
    title: "수심의 것",
    description:
      "소만 포구의 그물이 비어 오고 한낮에도 물이 차다. 노인들은 암초 너머 안개 밑에서 잠든 것이 다시 뒤척인다고 한다. 소만의 신임을 얻고, 뱃사공의 배로 난바다를 건너 — 수심의 것을 가라앉히면, 포구가 다시 일어선다.",
    giverNpcId: "saltmarsh_elder",
  },
} as const satisfies Record<string, StoryQuest>;

export type StoryQuestId = keyof typeof STORY_QUESTS;
