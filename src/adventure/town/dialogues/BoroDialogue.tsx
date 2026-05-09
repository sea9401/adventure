import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { STRANGER_FLAG_TRIAL_STARTED } from "./StrangerDialogue";

const QUEST_ID = "diola-boro-spider-silk";
const NEED = 30;

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  inventory: ReturnType<typeof useInventory>;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

export function BoroDialogue({
  npc,
  onClose,
  quests,
  completeQuest,
  inventory,
  storyFlags,
}: Props) {
  const trialStarted = storyFlags.has(STRANGER_FLAG_TRIAL_STARTED);
  const entry = quests.getEntry(QUEST_ID);

  if (!trialStarted) {
    return <NpcDialogue npc={npc} onClose={onClose} />;
  }

  if (entry.state === "completed") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"또 들러 주셨군요. 좋은 물건 들여놨거든요. 한번 보고 가시겠어요?\n…아, 그건 농담이고요. 거래는 늘 환영이지요."}
      />
    );
  }

  if (entry.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"오, 후드 손님이 추천해 주신 분이군요. 사근사근하게 모실게요.\n거미줄 재고가 자꾸 모자랍니다. 30개만 모아 주시면, 답례로 골드와 명성을 두둑이 드리지요. 거래는 양쪽이 다 좋아야 거래라잖아요?"}
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

  const have = inventory.materialCount("spider_silk");
  if (have >= NEED) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"이만큼이나! 거래는 좋아하시는 분이군요.\n약속한 답례, 받으시지요. …이 정도면 다음에 더 큰 일도 같이할 수 있겠어요."}
        primaryAction={{
          label: "건네준다",
          onClick: () => {
            const r = quests.tryDeliver(
              QUEST_ID,
              inventory.materialCount,
              inventory.consumeMaterial,
            );
            if (r.ok && completeQuest(QUEST_ID)) onClose();
          },
        }}
      />
    );
  }

  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={`외곽 숲의 거미가 잘 떨어뜨립니다. 진행: ${have}/${NEED}\n…너무 늦진 않게요. 재고 떨어지면 손님이 기다려요.`}
    />
  );
}
