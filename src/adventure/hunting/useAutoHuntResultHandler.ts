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

    // sessionStorage 페이로드는 두 가지 모양을 허용한다:
    //  - 신: `{ result, replayed }`  — useAutoHunt 가 collect 응답을 박은 것
    //  - 구: OfflineSimResult 자체   — 이전 버전 빌드가 남긴 잔여물 (replayed=false 로 취급)
    // result 가 ok 하면 둘 다 처리. replayed=true 면 도감/퀘스트 KV 재적용은 건너뛴다
    // (서버는 lastClaimResult 캐시에서만 응답하고, KV 는 이미 다른 경로에서 적용됐다고
    //  봐야 멀티 디바이스 시 중복 가산을 피할 수 있다).
    let result: OfflineSimResult;
    let replayed = false;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        "result" in (parsed as Record<string, unknown>)
      ) {
        const obj = parsed as { result: OfflineSimResult; replayed?: boolean };
        result = obj.result;
        replayed = obj.replayed === true;
      } else {
        result = parsed as OfflineSimResult;
      }
    } catch {
      return;
    }

    if (!replayed) {
      // fresh 결과만 KV 누적. (replay 면 KV 가 이미 다른 디바이스에서 적용됐을 가능성이
      // 높아 — 같은 디바이스의 lost-response 재시도 케이스에선 KV 가 누락되는 트레이드오프
      // 이지만 멀티 디바이스 중복보다는 작다.)
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
      if (result.died) adventureLog.incrementBattleLosses();
      for (const id of readyQuestIds) {
        const quest = getQuestById(id);
        if (quest) {
          addNotification(
            "quest_ready",
            `의뢰 조건 달성 — ${quest.title}: 길드에서 보상을 받을 수 있다.`,
          );
        }
      }
    }

    // 사망 시 치유소 이동 + summary 토스트 + 결과 모달은 replay 여부와 무관하게 표시한다.
    // (KV 가 아닌 화면 안내라 중복돼도 데이터 손상 없음. replay 자체가 드물고, 떠도 사용자
    //  가 결과를 확인하는 게 자연스럽다.)
    if (result.died) replaceLocation("town", "healing");
    const summary = summarizeOfflineResult(result);
    addNotification(
      "expedition",
      `자동 사냥 ${fmtHuntDuration(result.simulatedMs)}${summary ? ` — ${summary}` : ""}${result.died ? " (사망)" : ""}`,
    );
    // sessionStorage(외부) 에서 가져온 1회성 결과 → 모달 state 로 동기화.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoHuntResult(result);
    // 빈 deps — 마운트 1회만. adventureLog/quests/addNotification 등은 hook 들의 stable wrapper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { autoHuntResult, dismiss: () => setAutoHuntResult(null) };
}
