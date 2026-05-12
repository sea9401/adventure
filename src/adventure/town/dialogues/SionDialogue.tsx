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

// 시온 — 천공 성지 연금술사. 반말. 화산 재료 연구. 전부 deliver 의뢰.
const STEPS: QuestLineStep[] = [
  {
    id: "skyreach-alchemist-lava-core",
    offerText:
      "용암 핵이 필요한데, 화산 두꺼비나 불꽃 골렘을 잡으면 가끔 나오거든. 5개만 모아다 주면 포션 보유량을 늘려줄게.",
    activeText: (have, need) => `용암 핵은 화산 두꺼비·불꽃 골렘에게서 나와. — 진행 ${have}/${need}`,
    doneText: "다섯 개 다 모았군. 약속한 대로 — 포션 더 들고 다닐 수 있게 해줄게.",
  },
  {
    id: "skyreach-alchemist-phoenix-feather",
    offerText:
      "봉황 깃털로 점화제를 만들어 봐야겠어. 봉황령 불꽃 독수리에게서 넷만 모아다 줘.",
    activeText: (have, need) => `봉황 깃털은 봉황령 불꽃 독수리에게서 나와. — 진행 ${have}/${need}`,
    doneText: "넷이라… 점화제 실험 한번 해볼 수 있겠어. 자, 사례다.",
  },
  {
    id: "skyreach-alchemist-flame-scale",
    offerText:
      "비늘에서 내열제를 추출해야 해. 봉황령 화염 도마뱀의 비늘 여덟 장만 모아다 줘.",
    activeText: (have, need) => `화염 비늘은 봉황령 화염 도마뱀에게서 나와. — 진행 ${have}/${need}`,
    doneText: "여덟 장이나. 내열제 충분히 뽑겠어 — 받아.",
  },
  {
    id: "skyreach-alchemist-heart-essence",
    offerText:
      "화산의 심장을 잠재울 때마다 떨어지는 것들 — 용암 핵. 그걸로 봉인 보강제를 만들어 봐야겠어. 열 개만 모아다 줘.",
    activeText: (have, need) => `심장이 떨군 용암 핵이면 더 좋아. — 진행 ${have}/${need}`,
    doneText: "열 개라… 봉인 보강제 한 통은 나오겠어. 자, 사례다 — 또 모이면 가져와.",
  },
];

export function SionDialogue({ npc, onClose, quests, completeQuest, inventory }: Props) {
  return (
    <QuestLineDialogue
      npc={npc}
      onClose={onClose}
      quests={quests}
      completeQuest={completeQuest}
      inventory={inventory}
      steps={STEPS}
      idleText="화산 재료는 늘 모자라. 여분 생기면 또 들러 — 거래할 게 있을 거야."
    />
  );
}
