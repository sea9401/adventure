import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { STRANGER_FLAG_TRIAL_STARTED } from "./StrangerDialogue";

const QUEST_ID = "diola-rio-nails";
const NEED = 50;

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  inventory: ReturnType<typeof useInventory>;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

export function RioDialogue({
  npc,
  onClose,
  quests,
  completeQuest,
  inventory,
  storyFlags,
}: Props) {
  const trialStarted = storyFlags.has(STRANGER_FLAG_TRIAL_STARTED);
  const entry = quests.getEntry(QUEST_ID);

  // 트라이얼 시작 전 — 들뜬 어린이 톤.
  if (!trialStarted) {
    return <NpcDialogue npc={npc} onClose={onClose} />;
  }

  if (entry.state === "completed") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"또 만났네! 그때 그 못, 진짜 그게 무기로 변하다니!\n다른 형/누나한테는 비밀이야. 이건 우리 둘만의 약속!"}
      />
    );
  }

  if (entry.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"아저씨! 아니, 형/누나! 후드 손님이 너 보내준 거지?\n낡은 못 50개만 모아서 가져다줘. 진짜 신기한 거 알려줄게. 진짜로!"}
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

  // active — 인벤토리 잔량으로 즉시 판정.
  const have = inventory.materialCount("rusty_nail");
  if (have >= NEED) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"우와아! 진짜 50개 다 모았어?!\n약속한 거, 알려줄게. 우리 마을에서 떠도는 옛날 이야기야. 못이랑 방망이랑 합치면…"}
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
      text={`아직? 50개 모이면 바로 보여줄게! 진행: ${have}/${NEED}\n낡은 못은 시작 마을 주정뱅이들이 잘 떨어뜨리더라.`}
    />
  );
}
