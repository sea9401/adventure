import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useInventory } from "@/adventure/inventory/useInventory";

const HERBS_QUEST = "unhyang-sanha-herbs";
const HERBS_NEED = 8;
const BONES_QUEST = "unhyang-sanha-bones";
const BONES_NEED = 5;

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  inventory: ReturnType<typeof useInventory>;
};

// 산하 — 두 갈래 deliver 의뢰.
// 1) 산초꽃 ×8 (반복 가능, 12h 쿨다운, 포션 한도 +1)
// 2) 거인 비늘 ×5 (1회, 회복약 ×3 보상) — 보스 미구현이므로 늑대 무리장 8% 드롭에만 의존
//
// 분기 우선순위: 산초꽃 라인부터 (낮은 진입), 그 다음 거인 비늘 라인.
// 두 의뢰가 동시에 active 일 수 있어 순차 표시 (재료 부족하면 그쪽만 진행도 안내).
export function SanhaDialogue({
  npc,
  onClose,
  quests,
  completeQuest,
  inventory,
}: Props) {
  const herbs = quests.getEntry(HERBS_QUEST);
  const bones = quests.getEntry(BONES_QUEST);

  // ── 산초꽃 라인 ────────────────────────────────────────────────────────
  if (herbs.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "산기슭에 피는 산초꽃이요 — 작고 매운 꽃이에요.\n8송이만 모아다 주시면 약 만드는 솜씨로 보답할게요. 포션을 더 들고 다닐 수 있게 해드릴 수 있어요."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept(HERBS_QUEST);
            onClose();
          },
        }}
      />
    );
  }
  if (herbs.state === "active") {
    const have = inventory.materialCount("sancho_blossom");
    if (have >= HERBS_NEED) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={
            "오, 산초꽃을 다 모아오셨네요! 향이 정말 좋아요.\n약속한 대로 — 포션을 더 들고 다닐 수 있게 해드릴게요."
          }
          primaryAction={{
            label: "건네준다",
            onClick: () => {
              const r = quests.tryDeliver(
                HERBS_QUEST,
                inventory.materialCount,
                inventory.consumeMaterial,
              );
              if (r.ok) {
                completeQuest(HERBS_QUEST);
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
        text={`산초꽃은 산양이 가끔 떨군다고 들었어요. — 진행 ${have}/${HERBS_NEED}`}
      />
    );
  }

  // ── 거인 비늘 라인 (산초꽃 1회 완료 후 풀림) ──────────────────────────
  if (herbs.state === "completed" && bones.state === "available") {
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={
          "산초꽃은 잘 쓰고 있어요. 한 가지 더 부탁이 있는데…\n거인 비늘이 약을 갈무리하는 데 그만이거든요. 5개만 모아다 주시면 회복약을 가득 챙겨드릴게요."
        }
        primaryAction={{
          label: "받아들인다",
          onClick: () => {
            quests.accept(BONES_QUEST);
            onClose();
          },
        }}
      />
    );
  }
  if (bones.state === "active") {
    const have = inventory.materialCount("giant_scale");
    if (have >= BONES_NEED) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={
            "거인 비늘 5개… 정말 가져오셨네요. 무서운 일이었을 텐데요.\n약속한 회복약이에요. 잘 챙겨 두세요."
          }
          primaryAction={{
            label: "건네준다",
            onClick: () => {
              const r = quests.tryDeliver(
                BONES_QUEST,
                inventory.materialCount,
                inventory.consumeMaterial,
              );
              if (r.ok) {
                completeQuest(BONES_QUEST);
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
        text={`거인 비늘은 협곡의 무리장 늑대가 가끔 떨군다고 해요. — 진행 ${have}/${BONES_NEED}`}
      />
    );
  }

  // 둘 다 완료/쿨다운 중 — 일상 대화.
  return (
    <NpcDialogue
      npc={npc}
      onClose={onClose}
      text={
        "약초는 여유가 있을 때마다 채워두려고 해요. 산초꽃이 또 필요해지면 말씀드릴게요."
      }
    />
  );
}
