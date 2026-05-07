import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import { STORY_QUESTS } from "@/adventure/data/storyQuests";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { NotificationKind } from "@/lib/notifications";

type Props = {
  npc: Npc;
  onClose: () => void;
  crafting: ReturnType<typeof useCrafting>;
  inventory: ReturnType<typeof useInventory>;
  addNotification: (kind: NotificationKind, text: string) => void;
};

export function BlacksmithDialogue({
  npc,
  onClose,
  crafting,
  inventory,
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
          "처음 보는데… 모험가인가?\n그 나뭇가지 들고 마을 밖으로 나가는 건 위험하네.\n자, 받아 — 야구 방망이 제작서다. 대장간에 가서 직접 만들어 봐."
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
