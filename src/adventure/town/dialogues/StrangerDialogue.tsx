import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import type { useQuests } from "@/adventure/quests/useQuests";
import { KAI_FLAG_LAKE_HINT } from "./KaiDialogue";

// 폐허(ruins) 해금 플래그 — edge requirement 의 story.flagId 와 일치해야 함.
export const STRANGER_FLAG_RUINS_GUIDE = "stranger_ruins_guide";
// "안개 너머의 길" 트라이얼 시작 플래그. 디올라 NPC 들의 의뢰 노출 가드로 사용.
export const STRANGER_FLAG_TRIAL_STARTED = "stranger_trial_started";

const TRIAL_QUEST_IDS = [
  "diola-rio-nails",
  "diola-nora-bat-eyes",
  "diola-boro-spider-silk",
] as const;

type Props = {
  npc: Npc;
  onClose: () => void;
  storyFlags: ReturnType<typeof useStoryFlags>;
  quests: ReturnType<typeof useQuests>;
};

export function StrangerDialogue({ npc, onClose, storyFlags, quests }: Props) {
  const lakeHint = storyFlags.has(KAI_FLAG_LAKE_HINT);
  const trialStarted = storyFlags.has(STRANGER_FLAG_TRIAL_STARTED);
  const guided = storyFlags.has(STRANGER_FLAG_RUINS_GUIDE);

  // 안내까지 마친 뒤 재방문 — 짧은 격려/안부.
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

  // 트라이얼 진행 중 — 세 의뢰가 모두 completed 인지 확인.
  if (trialStarted) {
    const allDone = TRIAL_QUEST_IDS.every(
      (id) => quests.getEntry(id).state === "completed",
    );
    if (allDone) {
      // 시험 통과 — 폐허 안내.
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={
            "…촌장도, 노라도, 보로도 너를 받아들였군.\n호수의 일은 호수에서 시작된 게 아니야. 그 너머, 잊힌 폐허에서 시작된 거야. 옛 사람들이 봉인했던 무언가가 풀려나고 있어.\n길은 외곽 숲에서 폐허 쪽으로 나 있어. 표식은 내가 그어둘 테니, 갈 준비가 되거든 그쪽으로 가."
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
    // 아직 다 마치지 못함 — 격려.
    const doneCount = TRIAL_QUEST_IDS.filter(
      (id) => quests.getEntry(id).state === "completed",
    ).length;
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          `리오, 노라, 보로 — 셋이 너를 받아들이면 그때 이야기하지.\n…돌아와. 진행: ${doneCount}/3`
        }
      />
    );
  }

  // 카이의 떡밥은 들었지만 아직 시험을 시작하지 않은 경우 — 시작 분기.
  if (lakeHint) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "…드디어 왔구나. 어부에게 들었어?\n바로 길을 알려주진 않을 거야. 디올라가 너를 모르는데 내가 어떻게 너를 보내겠어.\n…리오, 노라, 보로. 셋의 부탁을 들어줘. 셋이 너를 받아들이면, 그때 길을 알려줄게."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            storyFlags.set(STRANGER_FLAG_TRIAL_STARTED);
            onClose();
          },
        }}
      />
    );
  }

  // 떡밥 들은 적 없는 초기 — npcs.ts 의 greeting 그대로.
  return <NpcDialogue npc={npc} onClose={onClose} />;
}
