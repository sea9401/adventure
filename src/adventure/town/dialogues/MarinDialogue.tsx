import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { STRANGER_FLAG_RUINS_GUIDE } from "./StrangerDialogue";

// 마린의 의뢰는 폐허(ruins) 가 열린 뒤에야 진행 가능 — 영혼 결정은 망령 드롭.
// 의뢰 완료 시 '디올라의 친구' 칭호가 page.tsx 의 completeQuest 에서 부여된다.
const QUEST_ID = "diola-marin-soul-crystals";
const NEED = 3;

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  inventory: ReturnType<typeof useInventory>;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

export function MarinDialogue({
  npc,
  onClose,
  quests,
  completeQuest,
  inventory,
  storyFlags,
}: Props) {
  const ruinsGuided = storyFlags.has(STRANGER_FLAG_RUINS_GUIDE);
  const entry = quests.getEntry(QUEST_ID);

  if (entry.state === "completed") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"…자네는 이제 디올라의 식구나 다름없네.\n안개 너머의 일이 아직 다 끝난 건 아니지만, 우리 마을은 자네를 기억할 거요."}
      />
    );
  }

  // 폐허 안내 받기 전 — 마린은 마을의 흐름을 따른다.
  if (!ruinsGuided) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"…자네는 아직 마을의 일을 다 보지 않았어.\n여관 구석의 손님과 먼저 이야기를 해보게. 그 사람의 안내가 있어야 우리 이야기도 시작되네."}
      />
    );
  }

  if (entry.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"…자네가 폐허에 들어갔다고 들었네. 무사한 모습을 보니 다행일세.\n옛 기록에 따르면, 폐허에서 나온 영혼 결정 셋만 있으면 이 마을과 폐허의 매듭을 풀 단서가 잡힌다고 했네. 떠도는 망령이 그것을 가지고 있어. 모아 주겠나?"}
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept(QUEST_ID);
            onClose();
          },
        }}
      />
    );
  }

  const have = inventory.materialCount("soul_crystal");
  if (have >= NEED) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"…셋이라. 자네 손에 든 그것은, 우리가 잊고 살아온 무언가의 조각이야.\n고맙네. 진심으로. 이 작은 어촌이 자네에게 진 빚은 잊지 않을 게요."}
        primaryAction={{
          label: "건네준다",
          onClick: () => {
            const r = quests.tryDeliver(
              QUEST_ID,
              inventory.materialCount,
              inventory.consumeMaterial,
            );
            if (r.ok) {
              // deliver 성공하면 재료는 이미 소비됨 — completeQuest 가 어떤 이유로 false 라도
              // (현재 코드상 일어나기 어렵지만 방어적으로) 다이얼로그는 닫아 stuck 방지.
              // 보상은 길드 게시판의 ready 큐에서 회수 가능.
              completeQuest(QUEST_ID);
              onClose();
            }
          },
        }}
      />
    );
  }

  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={`영혼 결정은 떠도는 망령이 가지고 있다고 들었네. 진행: ${have}/${NEED}\n…서두를 필요는 없네. 오래된 일이니까.`}
    />
  );
}
