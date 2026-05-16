"use client";

import { useMemo } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { readStoryFlagsState } from "@/adventure/storyFlags/storage";
import type { QuestProgressMap } from "@/adventure/quests/storage";
import { START_REGION_ID, type RegionId } from "@/adventure/data/world";
import {
  STORY_CHAPTERS,
  evaluateChapterRule,
  isChapterTbd,
  type StoryChapter,
} from "@/adventure/data/storyChapters";

function readVisitedRegionIds(raw: unknown): RegionId[] {
  if (!raw || typeof raw !== "object") return [START_REGION_ID];
  const parsed = raw as { visitedRegionIds?: unknown };
  if (!Array.isArray(parsed.visitedRegionIds)) return [START_REGION_ID];
  return parsed.visitedRegionIds.filter(
    (id): id is RegionId => typeof id === "string",
  );
}

export type ChapterStatus =
  // 완료 — 규칙 충족.
  | "completed"
  // 진행 중 — 완료된 챕터 직후의 첫 미완료 챕터(TBD 제외).
  | "current"
  // 예정 — current 보다 뒤. 아직 시작 가능 여부 불명.
  | "future"
  // 준비 중 — rule 이 tbd 라 후속 PR 의 콘텐츠 필요. 진행 흐름은 막지 않음.
  | "tbd";

export type ChapterEntry = {
  chapter: StoryChapter;
  status: ChapterStatus;
};

export type ChapterProgress = {
  entries: readonly ChapterEntry[];
  /** 가장 앞에 있는 미완료(TBD 제외) 챕터. 없으면 null (전부 완료/TBD). */
  currentChapter: StoryChapter | null;
  /** 완료된 챕터 수 — UI 의 "x / 25" 표시용. */
  completedCount: number;
  /** 전체 챕터 수 — STORY_CHAPTERS.length. */
  totalCount: number;
};

export function useChapterProgress(): ChapterProgress {
  // 세 출처 모두 SaveProvider Context 에서 읽어 derive — 별도 hook 의존성 없이 가볍게.
  const storyFlagsRaw = useSavedValue("storyFlags.v2");
  const questsRaw = useSavedValue("quest-progress.v2");
  const mapRaw = useSavedValue("map.v2");

  return useMemo(() => {
    const flagSet = new Set(readStoryFlagsState(storyFlagsRaw).flags);
    const questMap = (questsRaw ?? {}) as QuestProgressMap;
    const visitedSet = new Set<RegionId>(readVisitedRegionIds(mapRaw));

    const deps = {
      hasFlag: (id: string) => flagSet.has(id),
      isQuestCompleted: (id: string) =>
        (questMap[id]?.completedCount ?? 0) > 0,
      hasVisitedRegion: (id: RegionId) => visitedSet.has(id),
    };

    // 1차 — 각 챕터 완료/tbd 여부 산출. 모두 순수 함수.
    const evaluated = STORY_CHAPTERS.map((chapter) => {
      const tbd = isChapterTbd(chapter.rule);
      const completed = !tbd && evaluateChapterRule(chapter.rule, deps);
      return { chapter, tbd, completed };
    });

    // 2차 — current 챕터 = 완료된 챕터 뒤의 첫 미완료(TBD 제외). 한 번만 매칭.
    // TBD 챕터는 진행 흐름에서 skip — 그 뒤 챕터가 current 후보가 된다.
    const currentIdx = evaluated.findIndex((e) => !e.completed && !e.tbd);

    const entries: ChapterEntry[] = evaluated.map((e, idx) => {
      const status: ChapterStatus = e.completed
        ? "completed"
        : e.tbd
          ? "tbd"
          : idx === currentIdx
            ? "current"
            : "future";
      return { chapter: e.chapter, status };
    });

    const completedCount = evaluated.filter((e) => e.completed).length;
    const currentChapter =
      currentIdx >= 0 ? evaluated[currentIdx].chapter : null;
    return {
      entries,
      currentChapter,
      completedCount,
      totalCount: STORY_CHAPTERS.length,
    };
  }, [storyFlagsRaw, questsRaw, mapRaw]);
}
