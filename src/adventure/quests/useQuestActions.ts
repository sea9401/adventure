"use client";

import { applyQuestCompletionSideEffects } from "@/adventure/quests/questCompletionSideEffects";
import { useClaimQuestAction } from "@/adventure/quests/useClaimQuestAction";
import type { useAdventureLog } from "@/adventure/log/useAdventureLog";
import type { useCharacterState } from "@/adventure/character/useCharacterState";
import type { useParagonState } from "@/adventure/character/useParagonState";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";

// 퀘스트 수락/보상 지급 핸들러 묶음 — NPC 다이얼로그·길드 게시판 공용.
//
// completeQuest 는 EPIC #3-2 (2026-05-19) 부터 서버 권위. 클라는 questId 만 보내고
// 서버가 7개 saves 키를 통째 mutate → 응답 saves 를 각 hook 의 replaceFromSaved.
// 토스트 + 후처리 (titles/flags via applyQuestCompletionSideEffects) 는 서버 응답
// 후에 클라가 추가로 호출 — 보상 적용 자체는 서버가 했지만 클라 측 hook 상태도
// (titles map 등은 replaceFromSaved 로 이미 적용됨) 동일 결과로 수렴해야 하므로
// 동일 데이터 (questCompletionData) 를 한 번 더 호출해도 idempotent.
//
// 시그니처가 boolean → Promise<boolean> 로 바뀐 점에 유의 — 호출자는 await 또는 void.
export function useQuestActions(deps: {
  quests: ReturnType<typeof useQuests>;
  crafting: ReturnType<typeof useCrafting>;
  inventory: ReturnType<typeof useInventory>;
  characterStateHook: ReturnType<typeof useCharacterState>;
  paragon: ReturnType<typeof useParagonState>;
  adventureLog: ReturnType<typeof useAdventureLog>;
  storyFlags: ReturnType<typeof useStoryFlags>;
  grantTitle: (titleId: string) => void;
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
}) {
  const {
    quests,
    crafting,
    inventory,
    characterStateHook,
    paragon,
    adventureLog,
    storyFlags,
    grantTitle,
    addNotification,
  } = deps;

  const { claim } = useClaimQuestAction({
    inventory,
    characterStateHook,
    crafting,
    adventureLog,
    storyFlags,
    quests,
    paragon,
    addNotification,
  });

  const handleAcceptQuest = (id: string) => {
    quests.accept(id);
  };

  // 보상 지급 — 서버 권위. 성공(applied=true) 또는 idempotent(applied=false 라도 saves
  // 통째 교체로 자가 수렴) 시 true 반환 + onSuccess 호출. fetch 실패 / 서버 에러 시
  // false 반환 + onSuccess 미호출. onSuccess 패턴은 다이얼로그 호출자들이 보상 완료 후
  // onClose 를 부르는 공통 케이스를 단순화한다 (await/then 보일러플레이트 없이).
  const completeQuest = async (
    id: string,
    opts?: { onSuccess?: () => void },
  ): Promise<boolean> => {
    const result = await claim(id);
    if (!result) return false;
    if (result.applied) {
      addNotification(
        "quest_complete",
        result.tokens.length > 0
          ? `${result.questTitle} 완료 — ${result.tokens.join(", ")}`
          : `${result.questTitle} 완료`,
      );
      // 사이드 이펙트 (title / storyFlag) 는 서버가 이미 saves 에 박았고 replaceFromSaved
      // 가 클라 상태에 반영했지만, grantTitle 토스트 같은 부수 액션은 클라 훅을 거쳐야
      // 한다 — 같은 데이터로 한 번 더 호출해도 idempotent.
      applyQuestCompletionSideEffects(id, { grantTitle, storyFlags, quests });
    }
    opts?.onSuccess?.();
    return true;
  };

  const handleClaimQuest = (id: string) => {
    void completeQuest(id);
  };

  return { handleAcceptQuest, completeQuest, handleClaimQuest };
}
