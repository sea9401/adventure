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

// 한솔 — 바람골 길잡이. 반말. 잿빛 협로·봉황령 길 개척. 화산의 심장 메인 의뢰도 이 사람이.
const STEPS: QuestLineStep[] = [
  {
    id: "windvale-pathfinder-golems",
    offerText:
      "봉황령으로 길을 내려는데 재먼지 골렘이 길목을 막고 있어. 15체만 부숴 주면 그 너머로 가는 길을 알려줄게.",
    activeText: (have, need) => `골렘은 잿가루 속에 묻혀 있어. 잘 봐 두고 쳐. — 진행 ${have}/${need}`,
    doneText: "길목이 트였군. 잿빛 협로 너머 봉황령으로 가는 길, 이제 알려줄게 — 자, 사례다.",
  },
  {
    id: "windvale-pathfinder-salamander",
    offerText:
      "잿빛 협로에 불씨 도롱뇽이 들끓어. 열다섯만 꺼 주면 잿가루 사이로 길이 보일 거야.",
    activeText: (have, need) => `도롱뇽은 잿더미 속에서 불씨를 키워. 밟히지 마. — 진행 ${have}/${need}`,
    doneText: "불씨가 잦았어. 협로 다니기가 한결 낫겠다 — 받아.",
  },
  {
    id: "windvale-volcano-boss",
    offerText:
      "잿빛 협로를 지나 봉황령을 넘으면 화산 지대가 나와. 거기 깊은 곳에 — 사람들이 화산의 심장이라 부르는 게 깨어났어. 그놈을 잠재워야 그 너머 천공 성지로 가는 길이 열려. 부탁 좀 할게.",
    activeText: (have, need) => `혼자선 어림없어. 동료 데려가고, 단단히 준비해. — 진행 ${have}/${need}`,
    doneText: "정말 잠재웠나… 천공 성지로 가는 길이 열렸어. 고맙다 — 자, 약속한 거.",
  },
  {
    id: "windvale-pathfinder-ridge-scout",
    offerText:
      "잿빛 협로를 넘으면 봉황령이야. 거기 불꽃 독수리가 능선을 빙빙 돌아 — 열둘만 떨어뜨려 주면 첫 발 디딜 데가 생겨.",
    activeText: (have, need) => `독수리는 능선을 돌아. 내리꽂힐 때를 노려. — 진행 ${have}/${need}`,
    doneText: "능선에 첫 발 디딜 데가 생겼어. 봉황령 길은 거기서부터다 — 받아.",
  },
];

export function HansolDialogue({ npc, onClose, quests, completeQuest, inventory }: Props) {
  return (
    <QuestLineDialogue
      npc={npc}
      onClose={onClose}
      quests={quests}
      completeQuest={completeQuest}
      inventory={inventory}
      steps={STEPS}
      idleText="능선 너머는 한 번 길 낸다고 끝나는 곳이 아니야. 또 잿가루 묻힐 일 생기면 부르고."
    />
  );
}
