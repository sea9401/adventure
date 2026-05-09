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
          "아, 시작 마을에서 오셨다고요? 혹시 우리 수지가 보냈어요?\n아이고, 면목이 없네요. 요즘 호수 일이 얼마나 바쁜지, 새벽에 나가서 밤늦게야 들어오니까 편지 쓸 짬이 안 났어요. 매일 '오늘은 꼭 써야지' 하면서도 손도 못 댔는데… 벌써 한 달이 됐네요.\n돌아가시면 수지한테 좀 전해주세요. 잘 지내고 있으니 걱정 말라고. 일 정리되는 대로 꼭 한번 다녀가겠다고. 정말 미안하다고요."
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
