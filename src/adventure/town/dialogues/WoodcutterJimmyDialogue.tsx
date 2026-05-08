import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useQuests } from "@/adventure/quests/useQuests";

type Props = {
  npc: Npc;
  onClose: () => void;
  crafting: ReturnType<typeof useCrafting>;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
};

export function WoodcutterJimmyDialogue({
  npc,
  onClose,
  crafting,
  quests,
  completeQuest,
}: Props) {
  const banditQuest = quests.getEntry("village-jimmy-bandits");

  // 사전 조건 — 대장간 입문 퀘스트(볼드)를 끝낸 뒤 의뢰가 발생.
  if (!crafting.state.boldQuestComplete) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "어이, 모험가 양반.\n오늘도 숲에서 나무 좀 패다 왔지. 별일 없는 게 제일이야, 안 그래?"
        }
      />
    );
  }

  if (banditQuest.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "아, 모험가 양반. 잘 왔어.\n요즘 숲에 산적이 너무 많이 나와서 벌목하러 가질 못하고있어요. 산적들좀 처리해주세요.\n…고맙게도 예비 손도끼 한 자루 챙겨둔 게 있는데, 그거랑 약통 좀 더 쟁여둘 수 있게 해줄게."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept("village-jimmy-bandits");
            onClose();
          },
        }}
      />
    );
  }

  if (banditQuest.state === "active") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          `숲은 좀 잠잠해졌어요?\n산적 놈들 머릿수 좀 줄여 주쇼. — 진행 ${banditQuest.progress}/20`
        }
      />
    );
  }

  if (banditQuest.state === "ready") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "오, 스무 놈이나? 이젠 톱밥 좀 마음 편히 마실 수 있겠네.\n자, 약속한 거. 예비 손도끼랑 — 약통도 손봐뒀으니 작은 회복약 한 병쯤은 더 챙길 수 있을 거예요."
        }
        primaryAction={{
          label: "보상을 받는다",
          onClick: () => {
            if (completeQuest("village-jimmy-bandits")) onClose();
          },
        }}
      />
    );
  }

  // completed
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={
        "또 왔수?\n덕분에 숲이 한결 조용해졌어요. 도끼질 소리만 나도 산적들이 알아서 피하더라니까."
      }
    />
  );
}
