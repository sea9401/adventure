"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QUESTS, getQuestById, type Quest } from "../data/quests";
import type { MaterialId } from "../data/materials";
import {
  defaultQuestEntry,
  type QuestProgressEntry,
  type QuestProgressMap,
} from "./storage";
import { cooldownStatus } from "./cooldown";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";

export type ClaimResult =
  | { ok: true; quest: Quest }
  | { ok: false; reason: "not-found" | "not-ready" };

export type DeliverResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "not-deliver" | "not-active" | "insufficient" };

function readInitial(raw: unknown): QuestProgressMap {
  if (!raw || typeof raw !== "object") return {};
  return raw as QuestProgressMap;
}

export function useQuests() {
  const initial = useSavedValue("quest-progress.v2");
  const [progress, setProgress] = useState<QuestProgressMap>(() =>
    readInitial(initial),
  );
  // setState 업데이터가 큐잉되어 다음 렌더에 처리되므로 동기 계산용 미러 ref 가 필요.
  const progressRef = useRef<QuestProgressMap>(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useRemotePatch("quest-progress.v2", progress);

  const getEntry = useCallback(
    (id: string): QuestProgressEntry => progress[id] ?? defaultQuestEntry(),
    [progress],
  );

  const accept = useCallback((id: string) => {
    const cur = progressRef.current;
    const entry = cur[id] ?? defaultQuestEntry();
    if (entry.state !== "available") return;
    const quest = getQuestById(id);
    if (quest && cooldownStatus(quest, entry, Date.now()).onCooldown) return;
    const next: QuestProgressMap = {
      ...cur,
      [id]: { ...entry, state: "active", progress: 0 },
    };
    progressRef.current = next;
    setProgress(next);
  }, []);

  // 전투 승리 시 호출 — 활성 kill 퀘스트 중 타겟 일치하는 것의 진행도 증가.
  // deliver 퀘스트는 NPC 대화에서 직접 판정되므로 여기선 건너뜀.
  // 이번 호출에서 막 ready 로 전환된 퀘스트 ID 목록을 반환 (알림 트리거용).
  const recordKill = useCallback((monsterName: string): string[] => {
    const cur = progressRef.current;
    const next: QuestProgressMap = { ...cur };
    const justReady: string[] = [];
    let changed = false;
    for (const quest of QUESTS) {
      if (quest.target.kind !== "kill") continue;
      if (quest.target.monsterName !== monsterName) continue;
      const entry = next[quest.id] ?? defaultQuestEntry();
      if (entry.state !== "active") continue;
      if (entry.progress >= quest.target.count) continue;
      const newProgress = entry.progress + 1;
      const newState: QuestProgressEntry["state"] =
        newProgress >= quest.target.count ? "ready" : "active";
      next[quest.id] = { ...entry, progress: newProgress, state: newState };
      if (newState === "ready") justReady.push(quest.id);
      changed = true;
    }
    if (changed) {
      progressRef.current = next;
      setProgress(next);
    }
    return justReady;
  }, []);

  // deliver 퀘스트 전용 — NPC 대화에서 호출. 인벤토리 재료를 검사·소비하고
  // 상태를 active → ready 로 전환. 이후 호출자가 claim 으로 보상까지 마무리.
  // 인벤토리 접근은 호출자가 주입 (순환 의존 회피).
  const tryDeliver = useCallback(
    (
      id: string,
      materialCount: (m: MaterialId) => number,
      consumeMaterial: (m: MaterialId, n: number) => boolean,
    ): DeliverResult => {
      const quest = getQuestById(id);
      if (!quest) return { ok: false, reason: "not-found" };
      if (quest.target.kind !== "deliver") return { ok: false, reason: "not-deliver" };
      const cur = progressRef.current;
      const entry = cur[id] ?? defaultQuestEntry();
      if (entry.state !== "active") return { ok: false, reason: "not-active" };
      const need = quest.target.count;
      if (materialCount(quest.target.materialId) < need)
        return { ok: false, reason: "insufficient" };
      if (!consumeMaterial(quest.target.materialId, need))
        return { ok: false, reason: "insufficient" };
      const next: QuestProgressMap = {
        ...cur,
        [id]: { ...entry, state: "ready" },
      };
      progressRef.current = next;
      setProgress(next);
      return { ok: true };
    },
    [],
  );

  // 보상 수령 — 호출 측이 캐릭터 상태 갱신을 함께 처리.
  const claim = useCallback((id: string): ClaimResult => {
    const quest = getQuestById(id);
    if (!quest) return { ok: false, reason: "not-found" };
    const cur = progressRef.current;
    const entry = cur[id] ?? defaultQuestEntry();
    if (entry.state !== "ready") return { ok: false, reason: "not-ready" };
    const next: QuestProgressMap = {
      ...cur,
      [id]: {
        ...entry,
        state: quest.repeatable ? "available" : "completed",
        progress: 0,
        completedCount: entry.completedCount + 1,
        lastCompletedAt: Date.now(),
      },
    };
    progressRef.current = next;
    setProgress(next);
    return { ok: true, quest };
  }, []);

  return {
    progress,
    hydrated: true,
    getEntry,
    accept,
    recordKill,
    tryDeliver,
    claim,
  };
}
