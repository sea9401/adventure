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

// 도연 — 산악 가이드. 협곡/산기슭/봉황령/운저 평원 사정에 밝다.
// 인트로 절벽 늑대(반복, 단검 제작서) → 산기슭·협곡 사이드 → 봉황령·운저 평원 의뢰.
const STEPS: QuestLineStep[] = [
  {
    id: "unhyang-doyeon-wolves",
    offerText:
      "협곡의 절벽 늑대들이 떼를 키우고 있어. 무리장 손이 닿기 전에 솎아내야 해.\n10마리만 정리해 줘 — 굵은 송곳니가 나오면 단검 만드는 법도 알려줄게.",
    activeText: (have, need) =>
      `늑대는 외길에서 만나면 위험해. 발 디딜 자리부터 살펴. — 진행 ${have}/${need}`,
    doneText: "10마리 다 정리했나? 산이 좀 조용해졌겠어.\n자, 약속한 보상이다. 단검 만드는 법도 함께.",
  },
  {
    id: "unhyang-doyeon-stone-frogs",
    offerText:
      "산기슭 바위 두꺼비, 그놈들 등껍데기가 길을 막아. 열다섯 마리만 치워 주면 짐꾼들 발이 좀 편해질 거야.",
    activeText: (have, need) => `바위 두꺼비는 비탈 그늘에 모여 있어. — 진행 ${have}/${need}`,
    doneText: "두꺼비들 치웠구나. 길이 한결 낫겠어 — 받아.",
  },
  {
    id: "unhyang-doyeon-windspirits",
    offerText:
      "협곡 돌풍 정령은 발 디딜 데를 못 잡게 만들어. 열둘만 흩어 주면 한동안 바람이 좀 잦을 거야.",
    activeText: (have, need) => `정령은 바람 길목에서 만나. 등 돌리지 마. — 진행 ${have}/${need}`,
    doneText: "바람이 좀 잦았어. 협곡 다니기가 편해졌겠다 — 자.",
  },
  {
    id: "unhyang-guide-cloud-raiders",
    offerText:
      "운향 아래로 내려가면 너른 들판이 펼쳐져 있어. 요즘 거기 떠돌이 약탈자 무리가 자리를 잡았다더군. 15명만 손봐 주겠나?",
    activeText: (have, need) => `약탈자들은 평원 야영지에 뭉쳐 있어. — 진행 ${have}/${need}`,
    doneText: "평원이 좀 트였겠군. 짐수레가 다니기 한결 낫겠어 — 받아.",
  },
  {
    id: "unhyang-guide-bison-down",
    offerText:
      "산정 아래 들판 가봤어? 들소 떼가 길을 떡 막아. 스무 마리만 솎아 주면 짐수레가 좀 다닐 거야.",
    activeText: (have, need) => `들소는 떼로 밀어붙이니까 한 놈씩 떼어내. — 진행 ${have}/${need}`,
    doneText: "들판 길이 트였구나. 고맙다 — 자, 받아.",
  },
  {
    id: "unhyang-guide-phoenix-hunt",
    offerText:
      "봉황령에 불꽃 독수리가 너무 많아. 15마리만 정리해 주면 능선이 좀 안전해질 거야.",
    activeText: (have, need) =>
      `독수리는 능선을 빙빙 돌아 — 내리꽂힐 때를 노려. — 진행 ${have}/${need}`,
    doneText: "능선이 좀 조용해졌겠어. 순례자들도 한시름 놓겠지 — 받아.",
  },
];

export function DoyeonDialogue({
  npc,
  onClose,
  quests,
  completeQuest,
  inventory,
}: Props) {
  return (
    <QuestLineDialogue
      npc={npc}
      onClose={onClose}
      quests={quests}
      completeQuest={completeQuest}
      inventory={inventory}
      steps={STEPS}
      idleText="협곡도, 능선도 한 번 정리한다고 끝나는 곳이 아니야. 또 부탁할 일이 생기면 말할게."
    />
  );
}
