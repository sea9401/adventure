import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import {
  SUZY_FLAG_ACCEPTED,
  SUZY_FLAG_KAI_SEEN,
} from "./SuzyDialogue";

type Props = {
  npc: Npc;
  onClose: () => void;
  storyFlags: ReturnType<typeof useStoryFlags>;
};

export function KaiDialogue({ npc, onClose, storyFlags }: Props) {
  const accepted = storyFlags.has(SUZY_FLAG_ACCEPTED);
  const kaiSeen = storyFlags.has(SUZY_FLAG_KAI_SEEN);

  // 수지의 부탁을 받았고, 아직 카이에게 듣지 못한 경우 — 한 번만 진행.
  if (accepted && !kaiSeen) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "…뭐.\n시작 마을 여자? 아아, 그 사람 남편.\n…자갈밭 쪽에서 매일 본다. 새벽마다 거기서 그물을 깁고 있어. 편지? 글 쓸 줄 모른대. 그뿐이야.\n…살아는 있다. 가서 그렇게 전해줘."
        }
        primaryAction={{
          label: "고맙다고 한다",
          onClick: () => {
            storyFlags.set(SUZY_FLAG_KAI_SEEN);
            onClose();
          },
        }}
      />
    );
  }

  // 그 외에는 기본 인사 (npcs.ts 의 greeting 사용).
  return <NpcDialogue npc={npc} onClose={onClose} />;
}
