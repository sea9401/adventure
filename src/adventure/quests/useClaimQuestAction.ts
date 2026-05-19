"use client";

// 퀘스트 보상 수령 서버 액션 (EPIC #3-2). 클라는 questId 만 보내고 서버 tx 가
// character/inventory/crafting/log/storyFlags/quest-progress/paragon 통째 mutate.
// 응답으로 받은 saves 를 각 hook 의 replaceFromSaved 로 통째 교체.
//
// 이미 entry.state!=="ready" 인 idempotent 응답(첫 응답 손실 후 retry 등) 도
// saves 통째 교체로 자가 수렴.

import { useCallback } from "react";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useCharacterState } from "@/adventure/character/useCharacterState";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useAdventureLog } from "@/adventure/log/useAdventureLog";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useParagonState } from "@/adventure/character/useParagonState";
import { STORY_FLAGS_STORAGE_KEY } from "@/adventure/storyFlags/storage";
import { QUEST_PROGRESS_KEY } from "@/adventure/quests/storage";
import { readDeviceSessionId } from "@/lib/storage/deviceSession";
import { useRemoteSave } from "@/lib/storage/SaveProvider";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";

type Deps = {
  inventory: ReturnType<typeof useInventory>;
  characterStateHook: ReturnType<typeof useCharacterState>;
  crafting: ReturnType<typeof useCrafting>;
  adventureLog: ReturnType<typeof useAdventureLog>;
  storyFlags: ReturnType<typeof useStoryFlags>;
  quests: ReturnType<typeof useQuests>;
  paragon: ReturnType<typeof useParagonState>;
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
};

export type ClaimQuestResult = {
  /** 첫 호출(서버가 실제 mutate). false 면 entry 가 이미 ready 가 아니어서 no-op. */
  applied: boolean;
  questTitle: string;
  tokens: string[];
};

export function useClaimQuestAction(deps: Deps) {
  const {
    inventory,
    characterStateHook,
    crafting,
    adventureLog,
    storyFlags,
    quests,
    paragon,
    addNotification,
  } = deps;
  const remote = useRemoteSave();

  const claim = useCallback(
    async (questId: string): Promise<ClaimQuestResult | null> => {
      await remote.flush();
      let res: Response;
      try {
        const sessionId = readDeviceSessionId();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (sessionId) headers["X-Session-Id"] = sessionId;
        res = await fetch("/api/quests/claim", {
          method: "POST",
          headers,
          body: JSON.stringify({ questId }),
        });
      } catch {
        addNotification("info", "통신 오류 — 잠시 후 다시 시도해 주세요.");
        return null;
      }
      if (res.status === 401 || res.status === 410) return null;
      const data = (await res.json().catch(() => null)) as
        | {
            ok: true;
            applied: boolean;
            questTitle: string;
            tokens: string[];
            saves: {
              "character.v2"?: unknown;
              "inventory.v2"?: unknown;
              "crafting.v2"?: unknown;
              "adventure-log.v2"?: unknown;
              "storyFlags.v2"?: unknown;
              "quest-progress.v2"?: unknown;
              "paragon.v1"?: unknown;
            };
          }
        | { ok: false; error: string }
        | null;
      if (!data || data.ok === false) {
        addNotification("info", "보상 수령에 실패했다.");
        return null;
      }
      const saves = data.saves;
      if (saves["character.v2"] !== undefined) {
        characterStateHook.replaceFromSaved(saves["character.v2"]);
      }
      if (saves["inventory.v2"] !== undefined) {
        inventory.replaceFromSaved(saves["inventory.v2"]);
      }
      if (saves["crafting.v2"] !== undefined) {
        crafting.replaceFromSaved(saves["crafting.v2"]);
      }
      if (saves["adventure-log.v2"] !== undefined) {
        adventureLog.replaceFromSaved(saves["adventure-log.v2"]);
      }
      if (saves[STORY_FLAGS_STORAGE_KEY] !== undefined) {
        storyFlags.replaceFromSaved(saves[STORY_FLAGS_STORAGE_KEY]);
      }
      if (saves[QUEST_PROGRESS_KEY] !== undefined) {
        quests.replaceFromSaved(saves[QUEST_PROGRESS_KEY]);
      }
      if (saves["paragon.v1"] !== undefined) {
        paragon.replaceFromSaved(saves["paragon.v1"]);
      }
      return {
        applied: data.applied,
        questTitle: data.questTitle,
        tokens: data.tokens,
      };
    },
    [
      remote,
      inventory,
      characterStateHook,
      crafting,
      adventureLog,
      storyFlags,
      quests,
      paragon,
      addNotification,
    ],
  );

  return { claim };
}
