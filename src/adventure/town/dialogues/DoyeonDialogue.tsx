import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useQuests } from "@/adventure/quests/useQuests";

const QUEST_ID = "unhyang-doyeon-wolves";
const NEED = 10;

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
};

// 도연 — 협곡 절벽 늑대 10마리 처치 (kill 패턴, repeatable 6h).
// TrainerDialogue 의 단계 분기 패턴 그대로.
export function DoyeonDialogue({
  npc,
  onClose,
  quests,
  completeQuest,
}: Props) {
  const entry = quests.getEntry(QUEST_ID);

  if (entry.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "협곡의 절벽 늑대들이 떼를 키우고 있어. 무리장 손이 닿기 전에 솎아내야 해.\n10마리만 정리해 줘 — 보상은 충분히 챙겨줄 테니."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept(QUEST_ID);
            onClose();
          },
        }}
      />
    );
  }
  if (entry.state === "active") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          `늑대는 외길에서 만나면 위험해. 발 디딜 자리부터 살펴. — 진행 ${entry.progress}/${NEED}`
        }
      />
    );
  }
  if (entry.state === "ready") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "10마리 다 정리했나? 산이 좀 조용해졌겠어.\n자, 약속한 보상이다."
        }
        primaryAction={{
          label: "보상을 받는다",
          onClick: () => {
            if (completeQuest(QUEST_ID)) onClose();
          },
        }}
      />
    );
  }

  // completed (반복 가능 — 쿨다운 끝나면 다시 available 로 돌아옴)
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={
        "협곡은 한 번 정리한다고 끝나는 곳이 아니야. 또 늘면 다시 부탁할게."
      }
    />
  );
}
