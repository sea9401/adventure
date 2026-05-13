import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { FERRYMAN_FLAG_REEF_PASSAGE } from "./HaerangDialogue";

// 미르 — 소만 갯마을 아이. 의뢰 없이 분위기/떡밥만. storyFlag 로 대사 분기.
type Props = {
  npc: Npc;
  onClose: () => void;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

export function MireuDialogue({ npc, onClose, storyFlags }: Props) {
  const stilled = storyFlags.has("the_deep_one_stilled");
  const crossed = storyFlags.has(FERRYMAN_FLAG_REEF_PASSAGE);

  if (stilled) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "이제 갯벌이 안 출렁여요! 한낮에도요. 진짜로 가라앉았나 봐요.\n…저 조개껍데기들 중에 제일 큰 거, 아저씨한테 줄게요. 암초 밑에서 주웠대요 — 해랑 아저씨가."
        }
      />
    );
  }
  if (crossed) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "해랑 아저씨 배 타고 암초 너머 갔었죠? …거기, 노랫소리 들렸어요? 사이렌 거요.\n어른들은 갯벌이 출렁이는 건 물때 때문이래요. 근데 물때는 달이 정하는 거잖아요. 한낮인데 출렁이면 — 그건 밑에 있는 게 숨 쉬는 거예요. 난 알아요."
        }
      />
    );
  }
  // greeting 그대로.
  return <NpcDialogue npc={npc} onClose={onClose} />;
}
