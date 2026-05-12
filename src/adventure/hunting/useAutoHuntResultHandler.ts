"use client";

import { useEffect, useState } from "react";
import { getQuestById } from "@/adventure/data/quests";
import { AUTO_HUNT_RESULT_KEY } from "@/adventure/battle/autoHunt";
import { fmtHuntDuration } from "@/adventure/battle/AutoHuntResultModal";
import {
  summarizeOfflineResult,
  type OfflineSimResult,
} from "@/adventure/battle/offlineSim";
import type { useAdventureLog } from "@/adventure/log/useAdventureLog";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useNavTabs } from "@/lib/useNavTabs";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";

// 자동 사냥(원정) 수령 → collect 가 sessionStorage 에 결과 박고 reload. 마운트 시 여기서 읽어
// 모달 표시 + 도감/퀘스트 진행도(클라 KV) 추가 반영 + 알림. (서버는 character/inventory/
// crafting/map 만 갱신했고 adventureLog.v2 / quest-progress.v2 는 별도 키라 여기서 누적.)
export function useAutoHuntResultHandler(deps: {
  adventureLog: ReturnType<typeof useAdventureLog>;
  quests: ReturnType<typeof useQuests>;
  grantTitle: (titleId: string) => void;
  replaceLocation: ReturnType<typeof useNavTabs>["replaceLocation"];
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
}): { autoHuntResult: OfflineSimResult | null; dismiss: () => void } {
  const { adventureLog, quests, grantTitle, replaceLocation, addNotification } =
    deps;
  const [autoHuntResult, setAutoHuntResult] = useState<OfflineSimResult | null>(
    null,
  );

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(AUTO_HUNT_RESULT_KEY);
      if (raw) sessionStorage.removeItem(AUTO_HUNT_RESULT_KEY);
    } catch {}
    if (!raw) return;
    let result: OfflineSimResult;
    try {
      result = JSON.parse(raw) as OfflineSimResult;
    } catch {
      return;
    }
    const readyQuestIds = new Set<string>();
    let anyKill = false;
    for (const [name, n] of Object.entries(result.killsByName)) {
      for (let i = 0; i < n; i += 1) {
        adventureLog.addKill(name);
        for (const id of quests.recordKill(name)) readyQuestIds.add(id);
        anyKill = true;
      }
    }
    if (anyKill) grantTitle("first_blood");
    if (result.died) {
      adventureLog.incrementBattleLosses();
      replaceLocation("town", "healing");
    }
    const summary = summarizeOfflineResult(result);
    // 사망 여부와 무관하게 expedition — 사망 시엔 별도로 결과 모달(setAutoHuntResult)이
    // 눈에 띄게 뜨고, replaceLocation 으로 치유소로 보낸다.
    addNotification(
      "expedition",
      `자동 사냥 ${fmtHuntDuration(result.simulatedMs)}${summary ? ` — ${summary}` : ""}${result.died ? " (사망)" : ""}`,
    );
    for (const id of readyQuestIds) {
      const quest = getQuestById(id);
      if (quest) {
        addNotification(
          "quest_ready",
          `의뢰 조건 달성 — ${quest.title}: 길드에서 보상을 받을 수 있다.`,
        );
      }
    }
    // sessionStorage(외부) 에서 가져온 1회성 결과 → 모달 state 로 동기화.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoHuntResult(result);
    // 빈 deps — 마운트 1회만. adventureLog/quests/addNotification 등은 hook 들의 stable wrapper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { autoHuntResult, dismiss: () => setAutoHuntResult(null) };
}
