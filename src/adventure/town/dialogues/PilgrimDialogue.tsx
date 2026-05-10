import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";

type Props = {
  npc: Npc;
  onClose: () => void;
};

// 순례자 미상 — 운향 너머 (북방) 떡밥 placeholder. 후속 콘텐츠가 들어오면 분기 추가.
export function PilgrimDialogue({ npc, onClose }: Props) {
  return <NpcDialogue npc={npc} onClose={onClose} />;
}
