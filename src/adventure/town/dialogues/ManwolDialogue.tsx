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

// 만월 — 운봉 무기 안내 + "운봉석을 벼리는 법"(견갑 제작서 확정 루트).
// 거인 처치 전엔 도전 종용 → 처치 후 운봉석 ×6 deliver 의뢰 → 완료 후 제작 안내.
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

  // ore.state === "completed" — 운봉 무기/견갑 제작 안내 + 볼드 재회 라인(§7.1).
  const craftHint =
    "자네가 가진 비늘과 운봉석으로 — 무기 네 자루 중 하나, 그리고 견갑까지. 무기 제작서는 거인이 떨군 자리에서, 견갑 제작서는 내가 새겨준 그대로다. 대장간 모루 위에 비늘과 광석을 올려놓고 두드려보게.";
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
