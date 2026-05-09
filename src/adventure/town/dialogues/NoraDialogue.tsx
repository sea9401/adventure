import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { STRANGER_FLAG_TRIAL_STARTED } from "./StrangerDialogue";

const QUEST_ID = "diola-nora-bat-eyes";
const NEED = 10;

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  inventory: ReturnType<typeof useInventory>;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

export function NoraDialogue({
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
        text={"다시 와 주셔서 고마워요. 다락도 조용해졌고요.\n안개 짙은 밤은 우리 여관이 제일이에요. 한밤중에 차도 끓여드릴게요."}
      />
    );
  }

  if (entry.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"오, 후드 손님이 보내신 분이군요. 들어와요, 차 한 잔 드릴게요.\n…사실은 부탁이 있어요. 여관 다락에 박쥐가 자꾸 들어와서요. 박쥐 눈알 10개만 모아다 주시면, 며칠 전 사라진 손님이 두고 간 부적을 드릴게요. 어차피 안 찾으러 올 사람 같으니까요."}
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

  const have = inventory.materialCount("bat_eye");
  if (have >= NEED) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={"어머, 정말 가져오셨네요. 무서운 일 시켰네요, 미안해요.\n약속한 부적이에요. 닳긴 했지만 매듭은 아직 단단하니까, 잘 지녀 주세요."}
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
      text={`박쥐는 동굴이 많죠. 무리하지 마시고요. 진행: ${have}/${NEED}\n다락에서 또 소리 나면 어쩌나… 부탁할게요.`}
    />
  );
}
