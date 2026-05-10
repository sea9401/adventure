import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";

type Props = {
  npc: Npc;
  onClose: () => void;
};

// 만월 — 운봉 무기 라인을 안내할 대장장이. 무기·제작서가 들어오면 분기 추가.
export function ManwolDialogue({ npc, onClose }: Props) {
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
