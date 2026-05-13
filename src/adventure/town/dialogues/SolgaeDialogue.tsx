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

// 솔개 — 마른나루 들사냥꾼. 무뚝뚝한 반말. 옛길 들짐승 인트로(까마귀깃 두건 제작서) →
// 옛 변경 성채 폐성벽 까마귀 정리 (무진의 옛길 정리 완료 후 노출).
const STEPS: QuestLineStep[] = [
  {
    id: "dustford-solgae-wildcats",
    offerText:
      "갈대 살쾡이가 둥지를 헤집고 다녀 — 밭 가는 사람들이 못 살아. 열여덟만 정리해 주면 사례하지. 까마귀깃 두건 짓는 법도 알려줄게.",
    activeText: (have, need) => `살쾡이는 갈대 그늘에 웅크려. 발 디딜 자리부터 봐. — 진행 ${have}/${need}`,
    doneText: "열여덟 — 밭이 좀 조용해졌겠군.\n자, 약속한 거다. 까마귀깃 두건 짓는 법도 함께.",
  },
  {
    id: "dustford-solgae-ravens",
    offerText:
      "들까마귀 떼가 옛길 위를 빙빙 돌아 — 행상 짐을 자꾸 노려. 열여덟만 떨어뜨려 주면 한동안 길이 조용하겠다.",
    activeText: (have, need) => `까마귀는 빨라. 한 마리 떨굴 때마다 떼가 흩어졌다 다시 모여. — 진행 ${have}/${need}`,
    doneText: "옛길이 좀 조용해졌겠어. 행상들도 한시름 놓겠지 — 받아.",
  },
  {
    id: "dustford-solgae-wall-ravens",
    offerText:
      "이제 성채도 드나든다며? 거긴 까마귀가 더 많아 — 폐성벽 까마귀라고, 무너진 흉벽에 둥지를 틀었어. 열다섯만 정리해 주면 흉벽 다니기가 한결 낫겠다.",
    activeText: (have, need) => `폐성벽 까마귀는 흉벽 위에서 내리꽂혀. 위를 봐 두고 쳐. — 진행 ${have}/${need}`,
    doneText: "흉벽이 좀 트였겠어. 자, 받아.",
    acceptLabel: "받아들인다",
  },
  {
    // kill_within_hp — 노상강도 5을 HP 70% 이상으로 처치. solgae-ravens 후 노출.
    id: "dustford-solgae-pristine-bandits",
    offerText:
      "들사냥꾼 한 수는 빗장 맞기 전에 끝내는 거야. 노상강도 다섯을 — HP 70% 이상으로 — 흠 없이 잡아 와 봐. 가능하면 옛길에서 자네 이름이 좀 알려질 거다.",
    activeText: (have, need) =>
      `한 방 한 방을 깨끗하게. 빗장이 닿으면 그 한 마리는 안 쳐. — 흠 없이 잡은 수 ${have}/${need}`,
    doneText: "다섯 다 — 흠 없이. 옛길에서 자네 이름이 들리겠어. 자, 받아.",
    acceptLabel: "맡아 보겠다고 한다",
  },
];

export function SolgaeDialogue({ npc, onClose, quests, completeQuest, inventory }: Props) {
  return (
    <QuestLineDialogue
      npc={npc}
      onClose={onClose}
      quests={quests}
      completeQuest={completeQuest}
      inventory={inventory}
      steps={STEPS}
      idleText="옛길도, 흉벽도 한 번 비운다고 끝이 아니야. 또 부탁할 일 생기면 말할게."
    />
  );
}
