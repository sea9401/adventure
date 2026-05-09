import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { KAI_FLAG_LAKE_HINT } from "./KaiDialogue";

// 폐허(ruins) 해금 플래그 — edge requirement 의 story.flagId 와 일치해야 함.
export const STRANGER_FLAG_RUINS_GUIDE = "stranger_ruins_guide";

type Props = {
  npc: Npc;
  onClose: () => void;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

export function StrangerDialogue({ npc, onClose, storyFlags }: Props) {
  const lakeHint = storyFlags.has(KAI_FLAG_LAKE_HINT);
  const guided = storyFlags.has(STRANGER_FLAG_RUINS_GUIDE);

  // 카이의 떡밥을 들었고, 아직 안내를 받지 않은 경우 — 폐허 해금 분기.
  if (lakeHint && !guided) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "…드디어 왔구나. 어부에게 들었어?\n호수의 일은 호수에서 시작된 게 아니야. 그 너머, 잊힌 폐허에서 시작된 거야. 옛 사람들이 봉인했던 무언가가 풀려나고 있어.\n…길은 외곽 숲에서 폐허 쪽으로 나 있어. 표식은 내가 그어둘 테니, 갈 준비가 되거든 그쪽으로 가."
        }
        primaryAction={{
          label: "그러겠다고 한다",
          onClick: () => {
            storyFlags.set(STRANGER_FLAG_RUINS_GUIDE);
            onClose();
          },
        }}
      />
    );
  }

  // 안내를 받은 뒤 재방문 — 짧은 격려/안부.
  if (guided) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "표식은 내 몫까지 해뒀어. 이제 가는 건 네 몫이야.\n…돌아오거든 무엇을 봤는지 들려줘. 나도 아직 다 알진 못해."
        }
      />
    );
  }

  // 떡밥 들은 적 없는 초기 — npcs.ts 의 greeting 그대로.
  return <NpcDialogue npc={npc} onClose={onClose} />;
}
