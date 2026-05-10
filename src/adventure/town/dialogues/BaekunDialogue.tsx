import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";

type Props = {
  npc: Npc;
  onClose: () => void;
};

// 백운 — 운향의 노촌장. 메인 라인 (운봉의 거인 토벌 의뢰) 은 보스 구현 후 추가.
// 지금은 산정의 분위기만 전하는 인사 분기.
export function BaekunDialogue({ npc, onClose }: Props) {
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={
        "산을 오르느라 고단했겠지.\n구름 위에서는 바람도, 시간도 다르게 흐른다네. 잠시 머물다 가게."
      }
    />
  );
}
