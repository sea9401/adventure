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

// 갈매 — 소만 소금장수. 반말 섞인 장사꾼 말투. 갯벌 잡몹 인트로 3종(게딱지·갯벌 각반 제작서) →
// 산호초 섬 산호 가시 deliver (해랑의 선저 덧대기 완료 후 노출).
const STEPS: QuestLineStep[] = [
  {
    id: "saltmarsh-galmae-crabs",
    offerText:
      "갯벌에 집게발 게가 너무 불어 통발이 남아나질 않아. 20마리만 솎아 주면 사례하지 — 게딱지 다루는 법도 알려줄게.",
    activeText: (have, need) =>
      `집게발 게는 썰물 때 갯바위 그늘에 모여. 집게에 물리지 말고. — 진행 ${have}/${need}`,
    doneText: "스무 마리 다 정리했나? 통발 좀 살겠어.\n자, 약속한 사례다. 게딱지 손방패 만드는 법도 함께 가져가.",
  },
  {
    id: "saltmarsh-galmae-mudfish",
    offerText:
      "진흙 미꾸라지가 통발 미끼를 죄다 파먹어. 열여덟만 정리해 주면 갯벌 각반 짜는 법을 알려줄게 — 진창에 발 안 빠지게 해 주는 거야.",
    activeText: (have, need) => `미꾸라지는 진창 깊은 데로 파고들어. 끈질기게 쫓아. — 진행 ${have}/${need}`,
    doneText: "미끼가 좀 남아나겠군. 자 — 갯벌 각반 짜는 법이다. 진창 다닐 일 많을 테니 챙겨 둬.",
  },
  {
    id: "saltmarsh-galmae-shore-birds",
    offerText:
      "갯도요 떼가 말리던 생선을 다 물어가. 열여덟만 쫓아내 주면 어판장이 한결 조용해질 거야.",
    activeText: (have, need) => `갯도요는 빨라. 한 마리 떨어뜨릴 때마다 떼가 흩어졌다 다시 모여. — 진행 ${have}/${need}`,
    doneText: "생선이 좀 남아나겠어. 어판장 사람들이 고마워하겠군 — 받아.",
  },
  {
    id: "saltmarsh-galmae-reef-coral",
    offerText:
      "이제 난바다도 다닌다며? 그럼 부탁 하나 — 산호 가시는 송곳이며 통발 미늘로 두루 쓰여. 암초에서 부러진 것 여덟 조각만 들여와 주면 후하게 쳐주지.",
    activeText: (have, need) => `산호 가시는 가시 산호 골렘이 떨구거나, 약탈자가 무기로 들고 다녀. — 모은 양 ${have}/${need}`,
    doneText: "여덟 조각 — 좋아. 이만하면 한 철은 버티겠어. 자, 쳐준 값이다.",
    acceptLabel: "들여와 주겠다고 한다",
  },
  {
    // craft_item — 게딱지 손방패 두 점. galmae-crabs 보상 제작서를 받은 뒤 노출.
    id: "saltmarsh-galmae-shell-forge",
    offerText:
      "이번엔 통발 손질이 아니라 자네 손을 빌려야겠어 — 게딱지 손방패, 두 점만 새로 짜서 가져와 줘. 갯벌 다니는 일꾼 둘에게 한 점씩 들려 보내려고. 솜씨 좋게.",
    activeText: (have, need) =>
      `게딱지 손방패는 자네 공방에서 짜는 거야. 솜씨가 들쭉날쭉하면 그건 안 받아. — 만든 양 ${have}/${need}`,
    doneText: "두 점 — 좋은 솜씨야. 일꾼들 한 명씩 들려 보내지. 자, 약속한 값이다.",
    acceptLabel: "맡아 보겠다고 한다",
  },
];

export function GalmaeDialogue({
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
      idleText="갯벌도, 암초도 한 번 정리한다고 끝이 아니야. 또 손 빌릴 일 생기면 부르고."
    />
  );
}
