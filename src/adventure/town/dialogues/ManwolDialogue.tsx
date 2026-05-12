import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useInventory } from "@/adventure/inventory/useInventory";

type Props = {
  npc: Npc;
  onClose: () => void;
  storyFlags: ReturnType<typeof useStoryFlags>;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  inventory: ReturnType<typeof useInventory>;
};

const ORE_QUEST = "unhyang-manwol-ore-demo";
const ORE_NEED = 6;
const WEAPONS_QUEST = "unhyang-manwol-weapons";
const WEAPONS_NEED = 8;

// 만월 — "운봉석을 벼리는 법"(견갑 확정) → "운봉 네 자루"(무기 4종 제작서 확정) → 볼드 재회(§7.1).
// 거인 처치 전엔 도전 종용 → 처치 후 운봉석 ×6 deliver → ×8 더 deliver → 제작 안내 + 손잡이 심부름.
export function ManwolDialogue({
  npc,
  onClose,
  storyFlags,
  quests,
  completeQuest,
  inventory,
}: Props) {
  const giantDefeated = storyFlags.has("peak_giant_defeated");

  if (!giantDefeated) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "운봉석은 함부로 두드리면 깨져버려.\n…자네가 거인의 뼛조각을 가져올 만큼 강해졌을 때, 다시 와. 그때 진짜 무기를 만들어 주지."
        }
      />
    );
  }

  const ore = quests.getEntry(ORE_QUEST);

  // ── "운봉석을 벼리는 법" — 견갑 제작서 시연 ──
  if (ore.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "거인을 잠재웠다고? …거짓말이라도 그 비늘은 못 가져올 텐데. 좋아, 믿어 주지.\n그럼 한 가지 — 운봉석은 제대로 다룰 줄 아는 손이 드물어. 자네가 운봉석 여섯 덩이만 가져오면, 거인 어깨 비늘로 견갑을 어떻게 짜는지 시연해 줌세. 보고 나면 자네 손에도 새겨질 거야."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept(ORE_QUEST);
            onClose();
          },
        }}
      />
    );
  }
  if (ore.state === "active") {
    const have = inventory.materialCount("unbong_ore");
    if (have >= ORE_NEED) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={
            "운봉석 여섯 덩이… 제대로 골라왔군. 자, 잘 보게 — 비늘 결을 따라 운봉석을 끼워 넣고, 이렇게.\n됐어. 이제 자네 손에도 새겨졌을 거야. 견갑 제작서일세."
          }
          primaryAction={{
            label: "건네준다",
            onClick: () => {
              const r = quests.tryDeliver(
                ORE_QUEST,
                inventory.materialCount,
                inventory.consumeMaterial,
              );
              if (r.ok) {
                completeQuest(ORE_QUEST);
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
        text={`운봉석은 거인을 잠재울 때 떨어진다네. 충분히 모아 오게. — 진행 ${have}/${ORE_NEED}`}
      />
    );
  }

  // ── "운봉 네 자루" — 무기 4종 제작서 확정 루트 (견갑 시연 완료 후) ──
  const weapons = quests.getEntry(WEAPONS_QUEST);
  if (weapons.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "견갑은 봤으니 이제 무기 차례야. 운봉석 여덟 덩이만 더 가져와 봐 — 대검, 방벽, 장창, 발톱. 네 자루 전부 벼리는 법을 자네 손에 새겨 줌세."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept(WEAPONS_QUEST);
            onClose();
          },
        }}
      />
    );
  }
  if (weapons.state === "active") {
    const have = inventory.materialCount("unbong_ore");
    if (have >= WEAPONS_NEED) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={
            "운봉석 여덟 덩이… 좋아. 대검, 방벽, 장창, 발톱 — 네 자루의 결을 차례로 잡아 보겠네. 잘 봐 두게.\n됐어. 네 자루 전부, 자네 손에 새겨졌어. 손에 맞는 걸 골라 벼리게."
          }
          primaryAction={{
            label: "건네준다",
            onClick: () => {
              const r = quests.tryDeliver(
                WEAPONS_QUEST,
                inventory.materialCount,
                inventory.consumeMaterial,
              );
              if (r.ok) {
                completeQuest(WEAPONS_QUEST);
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
        text={`무기 네 자루를 벼리려면 운봉석이 좀 들어가. 여덟 덩이 채워 오게. — 진행 ${have}/${WEAPONS_NEED}`}
      />
    );
  }

  // weapons.state === "completed" — 제작 안내 + 볼드 재회 라인(§7.1).
  const craftHint =
    "운봉 무기 네 자루든 견갑이든 — 제작서는 자네 손에 다 새겨졌어. 거인이 떨군 비늘·운봉석·단단한 수정으로, 대장간 모루 위에 올려놓고 두드려보게.";
  const errandGiven = storyFlags.has("manwol_bold_errand_given");
  const letterDelivered = storyFlags.has("manwol_bold_letter_delivered");
  const reunionDone = storyFlags.has("manwol_bold_reunion_done");

  if (reunionDone) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={`볼드, 그 대머리 영감 잘 산다니 다행이군. 녀석 망치질은 여전한가 모르겠어.\n…${craftHint}`}
      />
    );
  }
  if (letterDelivered) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "녀석한테 다녀왔나? …볼드, 그 까칠한 대머리 영감 아직 살아 있다니 다행이야. 망치질 하나는 쓸 만했지.\n자, 자네 약통 좀 손봐줬어 — 회복약 몇 병이랑, 한 칸 더. 고맙네."
        }
        primaryAction={{
          label: "받는다",
          onClick: () => {
            inventory.addPotionCapacity(1);
            inventory.add("potion_heal_s", 5);
            storyFlags.set("manwol_bold_reunion_done");
            onClose();
          },
        }}
      />
    );
  }
  if (errandGiven) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={`볼드한테 그 손잡이 전해줬나? 시작 마을, 대머리 영감일세 — 못 알아볼 리 없어.\n…아 참, ${craftHint}`}
      />
    );
  }
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={`${craftHint}\n…그리고 한 가지 더. 시작 마을에 볼드라는 대머리 영감 아직 살아 있나? 망치질 하나는 쓸 만했지 — 이 손잡이 좀 전해 주게. '만월이 보낸다'고 하면 알 거야.`}
      primaryAction={{
        label: "손잡이를 받는다",
        onClick: () => {
          storyFlags.set("manwol_bold_errand_given");
          onClose();
        },
      }}
    />
  );
}
