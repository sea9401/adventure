import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { KEEP_FLAG_UNSEALED } from "./MujinDialogue";

// 보리 — 마른나루 역참 아이. 의뢰 없이 분위기/떡밥만. storyFlag 로 대사 분기.
type Props = {
  npc: Npc;
  onClose: () => void;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

export function BoriDialogue({ npc, onClose, storyFlags }: Props) {
  const felled = storyFlags.has("gatekeeper_felled");
  const unsealed = storyFlags.has(KEEP_FLAG_UNSEALED);

  if (felled) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "이제 밤에 쿵쿵 소리가 안 나요! 진짜로 멈췄나 봐요.\n…저 까마귀 깃들 중에 제일 큰 거, 아저씨한테 줄게요. 무너진 성벽 위에서 주웠대요 — 솔개 아저씨가."
        }
      />
    );
  }
  if (unsealed) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "무너진 벽으로 성채에 들어갔다 왔죠? …거기, 성문 소리 들렸어요? 쿵, 하고요.\n어른들은 그게 그냥 바람에 문이 흔들리는 거래요. 근데 바람은 한밤중에만 부는 게 아니잖아요. 한낮에도 쿵 하면 — 그건 안에 있는 게 움직이는 거예요. 난 알아요."
        }
      />
    );
  }
  // greeting 그대로.
  return <NpcDialogue npc={npc} onClose={onClose} />;
}
