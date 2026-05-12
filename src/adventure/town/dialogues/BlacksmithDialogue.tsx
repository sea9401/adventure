import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import { STORY_QUESTS } from "@/adventure/data/storyQuests";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import type { NotificationKind } from "@/lib/notifications";

const MANA_QUEST = "village-bold-mana-crystal";
const MANA_NEED = 5;

type Props = {
  npc: Npc;
  onClose: () => void;
  crafting: ReturnType<typeof useCrafting>;
  inventory: ReturnType<typeof useInventory>;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  storyFlags: ReturnType<typeof useStoryFlags>;
  addNotification: (kind: NotificationKind, text: string) => void;
};

export function BlacksmithDialogue({
  npc,
  onClose,
  crafting,
  inventory,
  quests,
  completeQuest,
  storyFlags,
  addNotification,
}: Props) {
  const knowsBat = crafting.knows("baseball_bat");
  const craftedBat = crafting.hasCrafted("baseball_bat");
  const armorReceived = crafting.state.boldQuestComplete;
  const slimeQuestDone = crafting.state.boldSlimeQuestComplete;
  const hasSlimeCore = inventory.materialCount("slime_core") > 0;

  // Stage A — 처음. 제작서 주기.
  if (!knowsBat) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "처음 보는데… 모험가인가?\n그 나무 막대 들고 마을 밖으로 나가는 건 위험하네.\n자, 받아 — 야구 방망이 제작서다. 대장간에 가서 직접 만들어 봐."
        }
        primaryAction={{
          label: "제작서를 받는다",
          onClick: () => {
            crafting.learnRecipe("baseball_bat");
            onClose();
          },
        }}
      />
    );
  }

  // Stage B — 제작서를 받았지만 아직 안 만듦.
  if (!craftedBat) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "방망이는 잘 만들고 있나?\n대장간 앞에서 망설이지 말게. 제작서대로 두드리면 되네."
        }
      />
    );
  }

  // Stage C — 만들어 옴. 가죽갑옷 주기.
  if (!armorReceived) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "오, 제대로 만들었군!\n…그런 천 옷으로 어딜 다녀. 이거도 챙겨가라 — 낡은 가죽갑옷이지만, 그쪽 천 쪼가리보단 백 배 낫지."
        }
        primaryAction={{
          label: "낡은 가죽갑옷을 받는다",
          onClick: () => {
            inventory.addEquipment("old_leather_armor");
            crafting.setBoldQuestComplete();
            addNotification(
              "quest_complete",
              `${STORY_QUESTS.bold_blacksmith_intro.title} 완료`,
            );
            onClose();
          },
        }}
      />
    );
  }

  // Stage D — 슬라임 핵을 들고 오면 1회성. 제작법을 받음(핵은 소모 X).
  if (armorReceived && !slimeQuestDone && hasSlimeCore) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "어, 이건… 슬라임 핵 아닌가?\n이걸로 꽤 괜찮은 방어구를 만들 수 있다네. 내가 장비 제조법을 주지 — 슬라임 조각도 함께 챙겨서 대장간으로 오게."
        }
        primaryAction={{
          label: "제조법을 받는다",
          onClick: () => {
            crafting.learnRecipe("squishy_armor");
            crafting.setBoldSlimeQuestComplete();
            addNotification(
              "quest_complete",
              `${STORY_QUESTS.bold_slime_core.title} 완료`,
            );
            onClose();
          },
        }}
      />
    );
  }

  // 만월의 손잡이 — 운향 만월이 맡긴 심부름(§7.1). 한 번만, 회복약 한 보따리로 답례.
  if (
    storyFlags.has("manwol_bold_errand_given") &&
    !storyFlags.has("manwol_bold_letter_delivered")
  ) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "만월이? …그 까칠한 노인네가 아직 살아 있구먼. 이 손잡이, 만월이 솜씨가 맞아 — 결을 보면 알지.\n답례다. 약통에 좋은 거 좀 채워뒀어. 만월이한테 전해 줘 — 망치질 아직 죽지 않았다고."
        }
        primaryAction={{
          label: "답례를 받는다",
          onClick: () => {
            inventory.add("potion_heal_s", 5);
            storyFlags.set("manwol_bold_letter_delivered");
            addNotification(
              "quest_complete",
              `${STORY_QUESTS.manwol_bold_reunion.title} — 볼드에게 전함`,
            );
            onClose();
          },
        }}
      />
    );
  }

  // 마정석 시연(§10.1) — 깊은 동굴을 아는(jimmy_deep_cave_quest) 모험가에게 노출.
  if (storyFlags.has("jimmy_deep_cave_quest")) {
    const mana = quests.getEntry(MANA_QUEST);
    if (mana.state === "available") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={
            "동굴 안쪽 큰 광맥, 거기 있던 놈한테서 마정석이 나온다지? 그거 제대로 다루려면 손이 익어야 해.\n다섯 덩이만 가져와 봐 — 그걸로 시연을 보여주지. 보고 나면 자네도 마정석 무기를 벼릴 수 있을 거야."
          }
          primaryAction={{
            label: "받아들인다",
            onClick: () => {
              quests.accept(MANA_QUEST);
              onClose();
            },
          }}
        />
      );
    }
    if (mana.state === "active") {
      const have = inventory.materialCount("mana_crystal");
      if (have >= MANA_NEED) {
        return (
          <NpcDialogue
            npc={npc}
            onClose={onClose}
            text={
              "마정석 다섯… 제대로 골라왔군. 잘 봐 — 결을 따라 이렇게 두드리면, 깨지지 않고 빛이 안에 머물지.\n됐어. 자네 손에도 새겨졌을 거다 — 마정석 팔찌 제작서다."
            }
            primaryAction={{
              label: "건네준다",
              onClick: () => {
                const r = quests.tryDeliver(
                  MANA_QUEST,
                  inventory.materialCount,
                  inventory.consumeMaterial,
                );
                if (r.ok) {
                  completeQuest(MANA_QUEST);
                  onClose();
                }
              },
            }}
          />
        );
      }
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={`마정석은 동굴 안쪽 그 광맥 골렘이 떨군다네. 다섯 덩이 채워 오게. — 진행 ${have}/${MANA_NEED}`}
        />
      );
    }
  }

  // Stage E — 끝. 일상 대화.
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={
        "왔구나.\n잘 지내고 있나? 무기 손볼 일 있으면 또 들르게."
      }
    />
  );
}
