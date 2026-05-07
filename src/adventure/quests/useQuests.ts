"use client";

import { useCallback, useEffect, useState } from "react";
import { QUESTS, getQuestById, type Quest } from "../data/quests";
import {
  defaultQuestEntry,
  loadQuestProgress,
  saveQuestProgress,
  type QuestProgressEntry,
  type QuestProgressMap,
} from "./storage";

export type ClaimResult =
  | { ok: true; quest: Quest }
  | { ok: false; reason: "not-found" | "not-ready" };

export function useQuests() {
  const [progress, setProgress] = useState<QuestProgressMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(loadQuestProgress());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveQuestProgress(progress);
  }, [hydrated, progress]);

  const getEntry = useCallback(
    (id: string): QuestProgressEntry => progress[id] ?? defaultQuestEntry(),
    [progress],
  );

  const accept = useCallback((id: string) => {
    setProgress((prev) => {
      const cur = prev[id] ?? defaultQuestEntry();
      if (cur.state !== "available") return prev;
      return { ...prev, [id]: { ...cur, state: "active", progress: 0 } };
    });
  }, []);

  // 전투 승리 시 호출 — 활성 퀘스트 중 타겟 일치하는 것의 진행도 증가
  const recordKill = useCallback((monsterName: string) => {
    setProgress((prev) => {
      let changed = false;
      const next: QuestProgressMap = { ...prev };
      for (const quest of QUESTS) {
        if (quest.target.monsterName !== monsterName) continue;
        const entry = next[quest.id] ?? defaultQuestEntry();
        if (entry.state !== "active") continue;
        if (entry.progress >= quest.target.count) continue;
        const newProgress = entry.progress + 1;
        const newState: QuestProgressEntry["state"] =
          newProgress >= quest.target.count ? "ready" : "active";
        next[quest.id] = { ...entry, progress: newProgress, state: newState };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  // 보상 수령 — 호출 측이 캐릭터 상태 갱신을 함께 처리
  const claim = useCallback(
    (id: string): ClaimResult => {
      const quest = getQuestById(id);
      if (!quest) return { ok: false, reason: "not-found" };
      const entry = progress[id] ?? defaultQuestEntry();
      if (entry.state !== "ready") return { ok: false, reason: "not-ready" };
      setProgress((prev) => {
        const cur = prev[id] ?? defaultQuestEntry();
        return {
          ...prev,
          [id]: {
            ...cur,
            state: quest.repeatable ? "available" : "completed",
            progress: 0,
            completedCount: cur.completedCount + 1,
            lastCompletedAt: Date.now(),
          },
        };
      });
      return { ok: true, quest };
    },
    [progress],
  );

  return { progress, hydrated, getEntry, accept, recordKill, claim };
}
