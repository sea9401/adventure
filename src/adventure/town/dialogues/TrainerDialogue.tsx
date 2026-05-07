import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useQuests } from "@/adventure/quests/useQuests";

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
};

export function TrainerDialogue({ npc, onClose, quests, completeQuest }: Props) {
  const slime = quests.getEntry("village-trainer-slimes");
  const dogs = quests.getEntry("village-trainer-dogs");
  const moles = quests.getEntry("village-trainer-moles");

  // === 슬라임 단계 ===
  if (slime.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "훈련이 필요해서 왔는가?\n일단 평야로 가서 슬라임 5마리를 잡고 돌아오게."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept("village-trainer-slimes");
            onClose();
          },
        }}
      />
    );
  }
  if (slime.state === "active") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          `슬라임은 잘 잡고 있나?\n평야에 가면 흔하지. — 진행 ${slime.progress}/5`
        }
      />
    );
  }
  if (slime.state === "ready") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "오, 다섯 마리를 다 잡아왔군.\n잘 했네 — 자, 보상이다. 작은 회복약 다섯 개와 조합법.\n모험을 하려면 포션 정도는 만들 줄 알아야 할걸세."
        }
        primaryAction={{
          label: "보상을 받는다",
          onClick: () => {
            if (completeQuest("village-trainer-slimes")) onClose();
          },
        }}
      />
    );
  }

  // === 들개 단계 (슬라임 완료 후) ===
  if (dogs.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "슬라임은 얌전한 편이지.\n다음은 들개다 — 평야와 외곽 숲에서 떼지어 다닌다.\n10마리만 잡아와. 어금니가 부딪치는 소리가 익숙해져야 해."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept("village-trainer-dogs");
            onClose();
          },
        }}
      />
    );
  }
  if (dogs.state === "active") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          `들개는 빠르고 사나워.\n자세를 낮추고 발을 노려라. — 진행 ${dogs.progress}/10`
        }
      />
    );
  }
  if (dogs.state === "ready") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "들개의 눈빛이 익숙해졌나?\n잘 했네. — 그럼 마지막 단련만 남았다."
        }
        primaryAction={{
          label: "보고한다",
          onClick: () => {
            if (completeQuest("village-trainer-dogs")) onClose();
          },
        }}
      />
    );
  }

  // === 두더쥐 단계 (들개 완료 후) ===
  if (moles.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "두더쥐를 우습게 보면 안 돼.\n땅 밑으로 들락거리며 빠르게 친다.\n10마리. 어디로 들어가는지, 어디로 나오는지 — 그걸 보는 눈을 길러봐."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept("village-trainer-moles");
            onClose();
          },
        }}
      />
    );
  }
  if (moles.state === "active") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          `두더쥐는 보이지 않을 때가 더 위험하지.\n흙 위의 떨림을 읽어라. — 진행 ${moles.progress}/10`
        }
      />
    );
  }
  if (moles.state === "ready") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "훌륭해. 슬라임, 들개, 두더쥐 — 평야의 셋을 다 끝냈군.\n자, 이건 내가 신참 시절 주워 모은 거다. 활력의 반지. 끼고 다녀라."
        }
        primaryAction={{
          label: "활력의 반지를 받는다",
          onClick: () => {
            if (completeQuest("village-trainer-moles")) onClose();
          },
        }}
      />
    );
  }

  // 모든 단련 완료 후 일상 대화.
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={
        "또 왔구나.\n이제 평야는 졸업이지. 한 단계 더 위로 나아가 봐."
      }
    />
  );
}
