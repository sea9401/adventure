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

// 노수호자 유성 — 별바다(천공 라인 endgame 정거장) 의 마지막 천공인 후예. 차분한 어른 말투.
// 회랑 정찰자 → 별빛 망령 → 회랑 골렘 → 황성 호위병 4단 라인으로 corridor 5종 + road 5종
// 제작서를 차례로 풀어 5단 craft chain(star → corridor → aether → road → empyrean) 의
// 중간 두 단계 출처를 한 NPC 에 모은다.
const STEPS: QuestLineStep[] = [
  {
    id: "star-haven-corridor-scouts",
    offerText:
      "별바다에 사람의 발소리가 닿은 게 얼마만인지. 자네의 결을 보니 첨탑은 지났겠지. 회랑에 흩어진 정찰자 잔재가 결을 거꾸로 흩어 놓고 있소. 열둘만 가라앉히면 — 회랑검과 회랑 방패의 결을 자네 손에 새겨 주리다.",
    activeText: (have, need) =>
      `회랑 정찰자들은 첨탑 위에서 흩어진 별빛 결을 따라 떠도오. 흐트러진 결 한 자루씩 가라앉히게. — 가라앉힌 결 ${have}/${need}`,
    doneText:
      "열둘 — 회랑의 결이 한 마디 가라앉았소. 약속한 대로 — 회랑검과 회랑 방패의 결을 자네 손에 새겨 두었소.",
    acceptLabel: "결을 가라앉히겠다고 한다",
  },
  {
    id: "star-haven-corridor-wraiths",
    offerText:
      "회랑 깊은 곳에 별빛 망령들이 결을 묶고 있소. 그들이 풀려야 회랑이 본래 모습으로 돌아오오. 열다섯만 풀어주면 — 회랑창과 회랑 너클의 결도 함께 새겨 주리다.",
    activeText: (have, need) =>
      `망령은 회랑의 가장 깊은 결에 매여 있소. 한 결씩 풀어주게. — 풀어준 결 ${have}/${need}`,
    doneText:
      "회랑이 한 결 더 가벼워졌소. 자, 약속한 결 — 회랑창과 회랑 너클이오.",
    acceptLabel: "결을 풀어주겠다고 한다",
  },
  {
    id: "star-haven-corridor-golems",
    offerText:
      "회랑의 골렘이 옛 회랑의 봉인 결을 쥐고 있소. 열만 가라앉히면 — 회랑 망토의 결을 자네 어깨에 얹어 주리다. 별의 정수도 자네 몫이오.",
    activeText: (have, need) =>
      `골렘 안쪽에 별의 정수가 굳어 있는 결이 있소. 신중히 결을 푸오. — 가라앉힌 골렘 ${have}/${need}`,
    doneText:
      "회랑의 봉인이 마침내 풀렸소. 회랑 망토의 결을 자네 어깨에 얹어 두었소 — 별의 정수도 챙겨 가게.",
    acceptLabel: "봉인을 풀겠다고 한다",
  },
  {
    id: "star-haven-throne-guards",
    offerText:
      "옥좌의 길에서 황성 호위병들이 길을 막고 있소. 열다섯만 정리해 길을 열면 — 황성 무구 다섯 자루의 결을 모두 자네 손에 새겨 주리다. 별바다가 자네에게 줄 수 있는 마지막 결이오.",
    activeText: (have, need) =>
      `황성 호위병은 옥좌의 길 곳곳에 흩어져 있소. 한 결씩 정리해 길을 여게. — 정리한 호위병 ${have}/${need}`,
    doneText:
      "길이 열렸소. 황성검·방패·창·너클·망토 — 다섯 자루 결을 모두 자네 손에 새겨 두었소. 옥좌가 자네를 알아보는 날이 멀지 않았소.",
    acceptLabel: "길을 열겠다고 한다",
  },
];

export function YuseongDialogue({ npc, onClose, quests, completeQuest, inventory }: Props) {
  return (
    <QuestLineDialogue
      npc={npc}
      onClose={onClose}
      quests={quests}
      completeQuest={completeQuest}
      inventory={inventory}
      steps={STEPS}
      idleText="별바다에 발걸음이 닿으면 — 언제든 다시 들르게. 옛 결을 가라앉히는 일은 한 사람만으로는 끝나지 않으니."
    />
  );
}
