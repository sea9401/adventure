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

// 산하 — 약초꾼. 전부 deliver 의뢰. 산초꽃·거인 비늘 → 다리 구간 재료 → 봉황령 화염 비늘.
// 노라(디올라 여관)와 친분 — 연계 의뢰는 §7.2(M5).
const STEPS: QuestLineStep[] = [
  {
    id: "unhyang-sanha-herbs",
    offerText:
      "산기슭에 피는 산초꽃이요 — 작고 매운 꽃이에요.\n8송이만 모아다 주시면 약 만드는 솜씨로 보답할게요. 산초꽃을 누벼 만드는 조끼, 그 만드는 법도 적어 드릴게요.",
    activeText: (have, need) => `산초꽃은 산양이 가끔 떨군다고 들었어요. — 진행 ${have}/${need}`,
    doneText:
      "오, 산초꽃을 다 모아오셨네요! 향이 정말 좋아요.\n약속한 대로 — 포션 한도를 늘려드릴게요. 조끼 만드는 법도 적어 드렸어요.",
    acceptLabel: "받아들인다",
  },
  {
    id: "unhyang-sanha-bones",
    offerText:
      "거인 비늘이 약을 갈무리하는 데 그만이거든요. 5개만 모아다 주시면 회복약을 가득 챙겨드릴게요.",
    activeText: (have, need) =>
      `거인 비늘은 협곡의 무리장 늑대가 가끔 떨군다고 해요. — 진행 ${have}/${need}`,
    doneText: "거인 비늘 5개… 정말 가져오셨네요. 무서운 일이었을 텐데요.\n약속한 회복약이에요. 잘 챙겨 두세요.",
  },
  {
    id: "unhyang-sanha-tough-hide",
    offerText:
      "단단한 가죽으로 약 보따리를 싸야 하거든요. 여섯 장만 모아다 주시면 회복약으로 보답할게요.",
    activeText: (have, need) => `단단한 가죽은 절벽 늑대 쪽이 쓸 만해요. — 진행 ${have}/${need}`,
    doneText: "가죽 여섯 장, 결이 좋네요. 약 보따리가 든든하겠어요 — 회복약 받으세요.",
  },
  {
    id: "unhyang-sanha-windstone",
    offerText:
      "바람 마석은 약을 오래 갈무리하는 데 그만이에요. 넷만 구해다 주시면 약 주머니를 더 크게 만들어 드릴게요.",
    activeText: (have, need) => `바람 마석은 협곡 돌풍 정령에게서 나와요. — 진행 ${have}/${need}`,
    doneText: "바람 마석 넷… 좋아요. 약속한 대로 약 주머니를 크게 만들어 드릴게요.",
  },
  {
    id: "unhyang-sanha-bison-hide",
    offerText:
      "들소 가죽으로 약상자를 짜야겠어요. 여섯 장만 모아다 주시면 회복약으로 보답할게요.",
    activeText: (have, need) => `들소 가죽은 운저 평원 들소 떼에서 모을 수 있어요. — 진행 ${have}/${need}`,
    doneText: "들소 가죽 여섯 장이요. 약상자가 튼튼하겠네요 — 회복약 받으세요.",
  },
  {
    id: "unhyang-herbalist-flame-scale",
    offerText:
      "봉황령 화염 도마뱀의 비늘이 약 달이는 데 쓸 만해요. 8개만 모아다 주시면, 포션 한 보따리 드릴게요.",
    activeText: (have, need) => `화염 비늘은 봉황령 화염 도마뱀에게서 나와요. — 진행 ${have}/${need}`,
    doneText: "화염 비늘 여덟 장, 뜨겁네요. 약속한 포션 한 보따리예요.",
  },
];

export function SanhaDialogue({
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
      idleText="약초는 여유가 있을 때마다 채워두려고 해요. 또 필요한 게 생기면 말씀드릴게요."
    />
  );
}
