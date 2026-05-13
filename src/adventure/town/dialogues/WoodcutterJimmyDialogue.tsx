import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { EquippedSlots } from "@/adventure/character/types";
import { ownsEquipment } from "@/adventure/inventory/ownership";

// 동굴 → 깊은 동굴 통로 해금 플래그. 의뢰 수락 시 set.
export const JIMMY_FLAG_DEEP_CAVE_QUEST = "jimmy_deep_cave_quest";

type Props = {
  npc: Npc;
  onClose: () => void;
  crafting: ReturnType<typeof useCrafting>;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  storyFlags: ReturnType<typeof useStoryFlags>;
  inventory: ReturnType<typeof useInventory>;
  equippedSlots: EquippedSlots;
};

export function WoodcutterJimmyDialogue({
  npc,
  onClose,
  crafting,
  quests,
  completeQuest,
  storyFlags,
  inventory,
  equippedSlots,
}: Props) {
  const banditQuest = quests.getEntry("village-jimmy-bandits");
  const deepCaveQuest = quests.getEntry("village-jimmy-deep-cave");

  // 사전 조건 — 대장간 입문 퀘스트(볼드)를 끝낸 뒤 의뢰가 발생.
  if (!crafting.state.boldQuestComplete) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "어이, 모험가 양반.\n오늘도 숲에서 나무 좀 패다 왔지. 별일 없는 게 제일이야, 안 그래?"
        }
      />
    );
  }

  // 히든 — 두더지왕의 드릴을 든(보유/장착) 모험가에게 (§11 hidden-mole-king).
  {
    const mole = quests.getEntry("hidden-mole-king");
    if (
      mole.state !== "completed" &&
      ownsEquipment(inventory.state, equippedSlots, "mole_king_drill")
    ) {
      if (mole.state === "available") {
        return (
          <NpcDialogue
            npc={npc}
            onClose={onClose}
            text={
              "그… 그거 두더지왕의 드릴 아니우? 진짜 있었구먼, 그놈.\n그럼 흔적도 있을 거야. 평야 두더지를 백 마리쯤 잡아보쇼 — 땅이 들썩이는 자리가 나올 거요. 거기 뭔가 있을 거란 말이지."
            }
            primaryAction={{
              label: "맡겠다",
              onClick: () => {
                quests.accept("hidden-mole-king");
                onClose();
              },
            }}
          />
        );
      }
      if (mole.state === "active") {
        return (
          <NpcDialogue
            npc={npc}
            onClose={onClose}
            text={`두더지 백 마리, 만만치 않지. 땅 들썩이는 자리 나오면 알려줘요. — 진행 ${mole.progress}/100`}
          />
        );
      }
      if (mole.state === "ready") {
        return (
          <NpcDialogue
            npc={npc}
            onClose={onClose}
            text={
              "백 마리나… 그래서, 들썩이던 자리 파봤더니 — 옛 굴이 하나 있더라고. 두더지왕이 살던 데래. 자네 드릴이 거기서 나온 거지.\n별 보물은 없었지만, 이야기 하나는 건졌수. 자, 수고비요."
            }
            primaryAction={{
              label: "보고를 마친다",
              onClick: () => {
                if (completeQuest("hidden-mole-king")) onClose();
              },
            }}
          />
        );
      }
    }
  }

  if (banditQuest.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "아, 모험가 양반. 잘 왔어.\n요즘 숲에 산적이 너무 많이 나와서 벌목하러 가질 못하고있어요. 산적들좀 처리해주세요.\n…고맙게도 예비 손도끼 한 자루 챙겨둔 게 있는데, 그거랑 약통 좀 더 쟁여둘 수 있게 해줄게."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept("village-jimmy-bandits");
            onClose();
          },
        }}
      />
    );
  }

  if (banditQuest.state === "active") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          `숲은 좀 잠잠해졌어요?\n산적 놈들 머릿수 좀 줄여 주쇼. — 진행 ${banditQuest.progress}/20`
        }
      />
    );
  }

  if (banditQuest.state === "ready") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "오, 스무 놈이나? 이젠 톱밥 좀 마음 편히 마실 수 있겠네.\n자, 약속한 거. 예비 손도끼랑 — 약통도 손봐뒀으니 작은 회복약 한 병쯤은 더 챙길 수 있을 거예요."
        }
        primaryAction={{
          label: "보상을 받는다",
          onClick: () => {
            if (completeQuest("village-jimmy-bandits")) onClose();
          },
        }}
      />
    );
  }

  // 산적 의뢰 완료 후 ─ 깊은 동굴 의뢰 라인.
  if (deepCaveQuest.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "모험가 양반, 마침 잘 왔어.\n요즘 동굴 더 안쪽까지 들어가서 나무를 패다 보니, 광맥이 두꺼운 자리 너머에서 영 안 좋은 기운이 풍기더라고…\n무서워서 도망쳐 나왔는데, 자꾸 마음에 걸려서. 한 번 가서 무엇이 있는지 봐주지 않을래요?"
        }
        primaryAction={{
          label: "맡겠다",
          onClick: () => {
            quests.accept("village-jimmy-deep-cave");
            storyFlags.set(JIMMY_FLAG_DEEP_CAVE_QUEST);
            onClose();
          },
        }}
      />
    );
  }

  if (deepCaveQuest.state === "active") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "동굴 안쪽까진 가봤수? 그 광맥 너머가 영 으스스하던데.\n조심해요. 무리하지 말고."
        }
      />
    );
  }

  if (deepCaveQuest.state === "ready") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "광물을 두른 거대한 골렘이라고? 그게 잠들어 있던 거였구먼…\n일단 잡아 줬으니 한동안은 안심하고 나무를 패겠어요. 자, 약속한 거 — 사례금이랑, 약통도 한 칸 더 손봐뒀으니 포션도 한 병씩 더 챙길 수 있을 거요."
        }
        primaryAction={{
          label: "보고를 마친다",
          onClick: () => {
            if (completeQuest("village-jimmy-deep-cave")) onClose();
          },
        }}
      />
    );
  }

  if (deepCaveQuest.state === "completed") {
    // 광맥 자리 재확인 — visit_region. deep-cave-hunter 노출 전에 우선 노출되는 한 단계.
    const tour = quests.getEntry("village-jimmy-deep-cave-tour");
    if (tour.state === "available") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={
            "사람들이 안 믿어요. 자네가 봤다는 그 광맥 자리, 한 번 더 가서 확인하고 와 주쇼. 다섯 번이면 마을 사람들도 자네 말을 믿을 게요."
          }
          primaryAction={{
            label: "맡겠다",
            onClick: () => {
              quests.accept("village-jimmy-deep-cave-tour");
              onClose();
            },
          }}
        />
      );
    }
    if (tour.state === "active") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={`광맥 자리, 또 다녀왔수? 다섯 번이면 마을 사람들도 자네 말을 믿을 게요. — 다녀온 횟수 ${tour.progress}/5`}
        />
      );
    }
    if (tour.state === "ready") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={"다섯 번 다 — 좋아. 이제 마을 사람들도 그 광맥 자리 이야기를 믿어. 자, 사례요."}
          primaryAction={{
            label: "보고를 마친다",
            onClick: () => {
              if (completeQuest("village-jimmy-deep-cave-tour")) onClose();
            },
          }}
        />
      );
    }

    // 광맥의 수호자 누적 사냥 "사냥 기록" — 지미가 주는 개인 도전(보스 사냥꾼 칭호 일부).
    const hunter = quests.getEntry("deep-cave-hunter");
    if (hunter.state === "available") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={
            "그놈, 가끔 다시 깨어난다는 소문이 있더라고. 광물 때문인지 뭔지.\n…열 번이나 잠재우면 동굴 안쪽이 한동안 조용하다고들 하던데. 나야 무서워서 못 가지만 — 모험가 양반이라면 기록 한번 채워볼 만하지 않겠어요?"
          }
          primaryAction={{
            label: "맡겠다",
            onClick: () => {
              quests.accept("deep-cave-hunter");
              onClose();
            },
          }}
        />
      );
    }
    if (hunter.state === "active") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={`그 광맥 골렘, 몇 번이나 잡았수? 천천히 해요, 무리하지 말고. — 진행 ${hunter.progress}/10`}
        />
      );
    }
    if (hunter.state === "ready") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={"열 번이라니… 이젠 톱밥을 발 뻗고 마실 수 있겠수. 자, 약속한 사례요."}
          primaryAction={{
            label: "보고를 마친다",
            onClick: () => {
              if (completeQuest("deep-cave-hunter")) onClose();
            },
          }}
        />
      );
    }
    // 산악 가이드 도연이 산정 협곡 목재를 부쳐옴(§7.1) — 지미가 전령을 알아본다.
    if (storyFlags.has("jimmy_doyeon_timber_done")) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={
            "어, 자네! 도연이 산정 협곡 목재를 부쳐왔더라고 — 안 휘는 게 진짜야. 이런 거 어디서 구하나 했는데, 자네가 도연한테 말 넣어준 거지?\n고맙수. 톱밥 한 잔 받아요 — 농담이고, 좋은 손잡이 깎으면 자네한테 먼저 보여줄게."
          }
        />
      );
    }
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "덕분에 동굴 안쪽도 마음 편히 다닐 수 있게 됐어요.\n…근데 그놈, 가끔 다시 깨어난다는 소문이 있더라고. 광물 때문인지 뭔지, 가끔 들러서 다잡아 두면 좋을 것 같수."
        }
      />
    );
  }

  // 산적 의뢰만 완료한 단계 — 깊은 동굴 의뢰가 아직 'available' 이 아닌 경우.
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={
        "또 왔수?\n덕분에 숲이 한결 조용해졌어요. 도끼질 소리만 나도 산적들이 알아서 피하더라니까."
      }
    />
  );
}
