import { describe, expect, it } from "vitest";
import { getQuestsForRegion } from "../data/quests";
import {
  BOARD_DAILY_LIMIT,
  getBoardQuestsForRegion,
} from "./board";
import type { QuestProgressEntry } from "./storage";
import { defaultQuestEntry } from "./storage";

// 모든 의뢰가 진행 안 된 fresh getEntry — 신규 캐릭터 상태.
const freshGetEntry = (): QuestProgressEntry => defaultQuestEntry();

describe("getBoardQuestsForRegion", () => {
  // unhyang 은 kill 의뢰가 5개 초과(14개) — 캡/셔플 동작을 확실히 검증할 수 있는 지역.
  it("같은 (date, region) 시드는 같은 5개를 같은 순서로 반환", () => {
    const a = getBoardQuestsForRegion("unhyang", freshGetEntry, "2026-05-14");
    const b = getBoardQuestsForRegion("unhyang", freshGetEntry, "2026-05-14");
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it("다른 date 는 다른 셔플 결과를 낸다 (풀이 충분히 크다면)", () => {
    const a = getBoardQuestsForRegion("unhyang", freshGetEntry, "2026-05-14");
    const b = getBoardQuestsForRegion("unhyang", freshGetEntry, "2026-05-15");
    expect(a.map((q) => q.id)).not.toEqual(b.map((q) => q.id));
  });

  it("active/ready 없는 fresh 캐릭터 → 최대 5장", () => {
    for (const region of ["village", "windvale", "unhyang"] as const) {
      const board = getBoardQuestsForRegion(region, freshGetEntry, "2026-05-14");
      expect(board.length).toBeLessThanOrEqual(BOARD_DAILY_LIMIT);
    }
  });

  it("active/ready 의뢰는 5개 캡과 무관하게 항상 포함", () => {
    // unhyang 의 의뢰 중 (1) 선행 의뢰가 없고 (2) 오늘의 5개에 안 든 것을 active 로 만들면
    // extras 로 합류해 보드 길이 = 5 + 1.
    const allQuests = getQuestsForRegion("unhyang");
    expect(allQuests.length).toBeGreaterThan(BOARD_DAILY_LIMIT);
    const todayIds = new Set(
      getBoardQuestsForRegion("unhyang", freshGetEntry, "2026-05-14").map(
        (q) => q.id,
      ),
    );
    const outsideQuest = allQuests.find(
      (q) => !todayIds.has(q.id) && !q.requiresQuestCompleted,
    );
    if (!outsideQuest) {
      throw new Error(
        "expected at least one no-prereq quest outside today's 5",
      );
    }
    const getEntry = (id: string): QuestProgressEntry =>
      id === outsideQuest.id
        ? { ...defaultQuestEntry(), state: "active", progress: 1 }
        : defaultQuestEntry();
    const board = getBoardQuestsForRegion("unhyang", getEntry, "2026-05-14");
    expect(board.map((q) => q.id)).toContain(outsideQuest.id);
    expect(board.length).toBe(BOARD_DAILY_LIMIT + 1);
  });

  it("비반복 + 이미 완료된 의뢰는 풀에서 제외", () => {
    // 비반복 의뢰 하나 찾아서 completedCount > 0 으로 만들면 보드에서 사라져야 함.
    const unhyangQuests = getQuestsForRegion("unhyang");
    const nonRepeatable = unhyangQuests.find((q) => !q.repeatable);
    if (!nonRepeatable) return; // 비반복이 없으면 스킵 (회귀 시 신호용)
    const getEntry = (id: string): QuestProgressEntry =>
      id === nonRepeatable.id
        ? { ...defaultQuestEntry(), state: "completed", completedCount: 1 }
        : defaultQuestEntry();
    // 모든 dateKey 에 대해 안 보여야 함 — 며칠을 돌려 확인.
    for (const day of ["2026-05-14", "2026-06-01", "2026-12-31", "2027-01-01"]) {
      const board = getBoardQuestsForRegion("unhyang", getEntry, day);
      expect(board.map((q) => q.id)).not.toContain(nonRepeatable.id);
    }
  });

  it("선행 의뢰 미충족인 의뢰는 풀에서 제외", () => {
    // requiresQuestCompleted 가 있는 의뢰를 찾아서, 그 선행이 0회 완료라면 보드에 안 떠야 함.
    const allRegions = [
      "village",
      "windvale",
      "saltmarsh",
      "dustford",
      "skyreach",
      "unhyang",
      "diola",
    ] as const;
    for (const region of allRegions) {
      const gated = getQuestsForRegion(region).find(
        (q) => q.requiresQuestCompleted,
      );
      if (!gated) continue;
      // 모든 entry 가 fresh (completedCount=0) — gated 는 보드에서 빠져야 함.
      for (const day of ["2026-05-14", "2026-05-15", "2026-05-16"]) {
        const board = getBoardQuestsForRegion(region, freshGetEntry, day);
        expect(board.map((q) => q.id)).not.toContain(gated.id);
      }
    }
  });
});
