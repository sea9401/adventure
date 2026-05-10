import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";

type Props = {
  npc: Npc;
  onClose: () => void;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

// 만월 — 운봉 무기 안내. 거인 처치 전엔 도전 종용, 처치 후엔 제작서·재료 안내.
export function ManwolDialogue({ npc, onClose, storyFlags }: Props) {
  const giantDefeated = storyFlags.has("peak_giant_defeated");

  if (!giantDefeated) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "운봉석은 함부로 두드리면 깨져버려.\n…자네가 거인의 뼛조각을 가져올 만큼 강해졌을 때, 다시 와. 그때 진짜 무기를 만들어 주지."
        }
      />
    );
  }

  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={
        "거인을 잠재웠다고? …거짓말이라도 그 비늘은 못 가져올 텐데.\n좋아. 자네가 가진 비늘과 운봉석으로 — 무기 네 자루 중 하나, 그리고 견갑까지. 도움이 될 걸세.\n제작서는 거인이 떨군 자리에서 챙겨왔겠지. 대장간 모루 위에 비늘과 광석을 올려놓고 두드려보게."
      }
    />
  );
}
