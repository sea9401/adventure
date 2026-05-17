import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import type { useInventory } from "@/adventure/inventory/useInventory";

// 5막 「빈 옥좌의 시대」 PR-C — 노수호자 유성(시작 마을 인스턴스) 의 그릇 빚기 라인.
// Ch 26(starfall_warden_felled) 이후 등장 인사, Ch 27(세 잔영 모두 처치) 완료 후
// 별빛 조각 30 deliver 의뢰 노출, 의뢰 완료 시 별빛 깃든 기예 6권 일괄 보상 + Ch 28 완료.
//
// star_haven_elder 와 동일 인물 — 4막 진행 중인 캐릭은 별바다 유성을 보지 못한 채
// 시작 마을에 처음 들어왔을 때 endgame_apex_defeated 미보유 → 짧은 인사로 가드.

const VESSEL_QUEST = "village-meteor-vessel";
const VESSEL_SHARDS = 30;

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  storyFlags: ReturnType<typeof useStoryFlags>;
  inventory: ReturnType<typeof useInventory>;
};

export function MeteorDialogue({
  npc,
  onClose,
  quests,
  completeQuest,
  storyFlags,
  inventory,
}: Props) {
  // 4막 미완 — 옥좌의 주재 협동전 클리어 전. 옥좌의 자리를 본 적이 없으니 모르는 사람.
  if (!storyFlags.has("endgame_apex_defeated")) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "…먼 길이었네. 자네는 아직 옥좌의 자리를 보지 못했지.\n천천히 가시게. 자리는 가지 않는다네."
        }
      />
    );
  }

  // Ch 27 미완 — 세 잔영(거인·수심의 메아리·성문지기) 중 하나라도 미처치.
  const ch27Done =
    storyFlags.has("starlit_giant_quelled") &&
    storyFlags.has("starlit_deep_quelled") &&
    storyFlags.has("starlit_gate_quelled");

  if (!ch27Done) {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "별바다에서 여기까지 걸어왔네. …옛 봉인 자리 세 곳에 별이 더 떨어졌다 들었으니.\n자네가 셋을 모두 잠재울 때까지 — 우물가에 앉아 기다리지. 산정 협곡, 안개 너머 산호초, 옛 변경 성채. 셋 다 자네 손이 닿아야 하네."
        }
      />
    );
  }

  // Ch 27 완료 후 — 그릇 빚기 의뢰 (별빛 조각 30 deliver).
  const vessel = quests.getEntry(VESSEL_QUEST);
  if (vessel.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "잘 왔네. 셋을 모두 잠재웠다더군 — 자네 손에 별빛이 들렸을 게야.\n…한 자리에 모일 빛을 두려면, 그릇이 필요하네. 누구의 것도 아닌 빛을, 누구의 것도 아닌 자리에 두기 위한 그릇. 별빛 조각 서른 점이면 충분해. 자네가 거두어 가져와 주게. 내가 그것으로 마지막 그릇을 빚어 두지."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept(VESSEL_QUEST);
            onClose();
          },
        }}
      />
    );
  }

  if (vessel.state === "active") {
    const have = inventory.materialCount("starfall_shard");
    if (have >= VESSEL_SHARDS) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={
            "…서른 점. 그래, 충분하네.\n자, 받게 — 그릇을 빚는 자리에 자네가 쓸 결 여섯 권을 같이 묶어 두었네. 별빛에 닿은 자만이 풀 수 있는 결이지. 익히든 두든, 자네의 것이야."
          }
          primaryAction={{
            label: "건네준다",
            onClick: () => {
              const r = quests.tryDeliver(
                VESSEL_QUEST,
                inventory.materialCount,
                inventory.consumeMaterial,
              );
              if (r.ok) {
                completeQuest(VESSEL_QUEST);
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
        text={`별빛 조각이 얼마나 모였나? 서른 점이 되거든 다시 오시게. — 진행 ${have}/${VESSEL_SHARDS}`}
      />
    );
  }

  // 의뢰 완료 후 — Ch 30 진입 떡밥(옥좌의 환영). 후속 PR 에서 활용.
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={
        "그릇은 빚어 두었네. 자네에게 묶지 않을 결로 — 누구의 것도 아닌 자리에. 별빛이 한 점 한 점 그릇 가장자리에 가라앉는 것을 자네도 보겠지.\n옛 옥좌의 환영이 아직 자네 등을 따라온다는 얘기를 들었네. 그것을 마지막으로 떼어 내는 자리는 — 자네가 잘 알고 있을 게야."
      }
    />
  );
}
