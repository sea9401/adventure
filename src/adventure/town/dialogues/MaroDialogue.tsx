import type { Npc } from "@/adventure/data/npcs";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useInventory } from "@/adventure/inventory/useInventory";
import { QuestLineDialogue, type QuestLineStep } from "./questLineDialogue";

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  inventory: ReturnType<typeof useInventory>;
};

// 마로 — 바람골 역참지기. 하오체. 들소 떼 관리.
const STEPS: QuestLineStep[] = [
  {
    id: "windvale-keeper-bison",
    offerText:
      "들소 떼가 역참 울타리를 자꾸 들이받아서 못 살겠소. 20마리만 솎아 주시면 사례하리다.",
    activeText: (have, need) => `들소는 떼로 몰아붙이오. 한 놈씩 떼어내시오. — 진행 ${have}/${need}`,
    doneText: "스무 마리라… 울타리가 한시름 놓겠구려. 자, 약속한 사례요.",
  },
  {
    id: "windvale-keeper-bison-king",
    offerText:
      "솎아냈더니 더 큰 떼가 내려오는구려. 마흔 마리만 더 정리해 주시오 — 이번엔 울타리가 버텨야 할 텐데.",
    activeText: (have, need) => `이번 떼는 머릿수가 많소. 무리하지 마시오. — 진행 ${have}/${need}`,
    doneText: "마흔이나… 이제 역참이 좀 조용하겠소. 받으시오.",
  },
];

export function MaroDialogue({ npc, onClose, quests, completeQuest, inventory }: Props) {
  return (
    <QuestLineDialogue
      npc={npc}
      onClose={onClose}
      quests={quests}
      completeQuest={completeQuest}
      inventory={inventory}
      steps={STEPS}
      idleText="역참은 오가는 이가 끊기지 않는 한 굴러가오. 들소만 아니면 조용한 곳이오."
    />
  );
}
