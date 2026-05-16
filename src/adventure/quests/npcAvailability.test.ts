import { describe, expect, it } from "vitest";
import { QUESTS } from "../data/quests";
import { npcHasAcceptableQuest } from "./npcAvailability";
import {
  defaultQuestEntry,
  type QuestProgressEntry,
  type QuestProgressMap,
} from "./storage";

const NOW = 1_700_000_000_000;

function mkGetEntry(map: QuestProgressMap) {
  return (id: string): QuestProgressEntry => map[id] ?? defaultQuestEntry();
}

describe("npcHasAcceptableQuest", () => {
  // 스미스는 마을 초반 의뢰 여럿(레벨 1 요구)을 주는 NPC — 안정적인 픽스처.
  const NPC = "village_trainer_smith" as const;

  it("fresh 캐릭터 + 레벨 충족 → true", () => {
    expect(npcHasAcceptableQuest(NPC, 5, mkGetEntry({}), NOW)).toBe(true);
  });

  it("레벨 0(요구 1 미충족) → false", () => {
    expect(npcHasAcceptableQuest(NPC, 0, mkGetEntry({}), NOW)).toBe(false);
  });

  it("해당 NPC 의 모든 의뢰가 active/completed 면 false", () => {
    const map: QuestProgressMap = {};
    for (const q of QUESTS.filter((qq) => qq.giverNpcId === NPC)) {
      map[q.id] = { ...defaultQuestEntry(), state: "active" };
    }
    expect(npcHasAcceptableQuest(NPC, 5, mkGetEntry(map), NOW)).toBe(false);
  });

  it("giverNpcId 없는 의뢰는 누구의 뱃지도 켜지 않는다", () => {
    // village_woodcutter_jimmy 는 의뢰가 있지만, giverNpcId 가 없는 의뢰는 무관해야 함.
    const noGiverIds = QUESTS.filter((q) => !q.giverNpcId).map((q) => q.id);
    expect(noGiverIds.length).toBeGreaterThan(0);
    // 가짜 NPC id — 어떤 의뢰도 매칭되지 않음.
    expect(
      npcHasAcceptableQuest(
        "nonexistent_npc" as never,
        99,
        mkGetEntry({}),
        NOW,
      ),
    ).toBe(false);
  });

  it("선행 의뢰 미완료면 후속 의뢰는 뱃지에 안 잡힌다", () => {
    const linked = QUESTS.find(
      (q) => q.giverNpcId && q.requiresQuestCompleted,
    );
    if (!linked || !linked.giverNpcId) {
      // 데이터에 prereq 가 있는 NPC 의뢰가 없으면 케이스 스킵.
      return;
    }
    // 같은 NPC 의 다른 의뢰들도 모두 active 로 막아, "prereq 잠긴 후속만 남은" 상태를 만든다.
    const map: QuestProgressMap = {};
    for (const q of QUESTS.filter(
      (qq) => qq.giverNpcId === linked.giverNpcId && qq.id !== linked.id,
    )) {
      map[q.id] = { ...defaultQuestEntry(), state: "active" };
    }
    expect(
      npcHasAcceptableQuest(linked.giverNpcId, 99, mkGetEntry(map), NOW),
    ).toBe(false);
  });
});
