import type { Npc } from "@/adventure/data/npcs";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useInventory } from "@/adventure/inventory/useInventory";
import { getQuestById, questTargetTotal, type Quest } from "@/adventure/data/quests";

// NPC 가 여러 의뢰를 순차적으로 내주는 다이얼로그용 헬퍼.
// steps 배열을 위→아래로 훑어, "처리 대기"인 첫 의뢰를 보여준다:
//   ready                       → 보상 수령
//   active + deliver + 재료 충분 → 건네주기
//   active                      → 진행도 안내
//   available + 잠금 풀림        → 수주 제안
// 반복 의뢰는 한 번 이상 완료한 뒤엔 "뒤에 아직 대기 중인 의뢰가 있으면" 양보한다
// (= 인트로 반복 의뢰가 후속 라인을 막지 않도록). 모두 끝나면 다시 제안된다.
export type QuestLineStep = {
  id: string;
  /** 수주 가능 시 의뢰 제안 텍스트. */
  offerText: string;
  /** 진행 중 텍스트. kill 은 (진행도, 목표치), deliver 는 (보유, 필요) 가 넘어온다. */
  activeText: (have: number, need: number) => string;
  /** 완료 가능(ready) 또는 deliver 재료 충분 시 텍스트. */
  doneText: string;
  /** 수주 버튼 라벨. 기본 "받아들인다". */
  acceptLabel?: string;
};

type Props = {
  npc: Npc;
  onClose: () => void;
  quests: ReturnType<typeof useQuests>;
  completeQuest: (id: string) => boolean;
  inventory: ReturnType<typeof useInventory>;
  steps: QuestLineStep[];
  /** 보여줄 의뢰가 하나도 없을 때(전부 완료/쿨다운/잠금) 일상 대화. */
  idleText: string;
};

export function QuestLineDialogue({
  npc,
  onClose,
  quests,
  completeQuest,
  inventory,
  steps,
  idleText,
}: Props) {
  const resolved = steps.map((step) => {
    const quest = getQuestById(step.id);
    if (!quest) return { step, quest: undefined as Quest | undefined, entry: undefined, pending: false };
    const entry = quests.getEntry(step.id);
    let pending = false;
    if (entry.state === "ready" || entry.state === "active") pending = true;
    else if (entry.state === "available") {
      const locked =
        !!quest.requiresQuestCompleted &&
        quests.getEntry(quest.requiresQuestCompleted).state !== "completed";
      pending = !locked;
    }
    return { step, quest, entry, pending };
  });

  for (let i = 0; i < resolved.length; i += 1) {
    const r = resolved[i];
    if (!r.quest || !r.entry || !r.pending) continue;

    // 인트로 반복 의뢰가 후속 라인을 막지 않도록 — 한 번 이상 완료했고 뒤에 대기 중인 게 있으면 양보.
    if (r.quest.repeatable && r.entry.completedCount > 0) {
      const laterPending = resolved.slice(i + 1).some((x) => x.pending);
      if (laterPending) continue;
    }

    const { quest, entry, step } = r;
    const need = questTargetTotal(quest.target);

    if (entry.state === "ready") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={step.doneText}
          primaryAction={{
            label: "보상을 받는다",
            onClick: () => {
              if (completeQuest(step.id)) onClose();
            },
          }}
        />
      );
    }

    if (entry.state === "active") {
      if (quest.target.kind === "deliver") {
        const have = inventory.materialCount(quest.target.materialId);
        if (have >= need) {
          return (
            <NpcDialogue
              npc={npc}
              onClose={onClose}
              text={step.doneText}
              primaryAction={{
                label: "건네준다",
                onClick: () => {
                  const res = quests.tryDeliver(
                    step.id,
                    inventory.materialCount,
                    inventory.consumeMaterial,
                  );
                  if (res.ok) {
                    completeQuest(step.id);
                    onClose();
                  }
                },
              }}
            />
          );
        }
        return (
          <NpcDialogue npc={npc} onClose={onClose} text={step.activeText(have, need)} />
        );
      }
      return (
        <NpcDialogue
          npc={npc}
          onClose={onClose}
          text={step.activeText(entry.progress, need)}
        />
      );
    }

    // available (잠금 X, 쿨다운 X)
    return (
      <NpcDialogue
        npc={npc}
        onClose={onClose}
        text={step.offerText}
        primaryAction={{
          label: step.acceptLabel ?? "받아들인다",
          onClick: () => {
            quests.accept(step.id);
            onClose();
          },
        }}
      />
    );
  }

  return <NpcDialogue npc={npc} onClose={onClose} text={idleText} />;
}
