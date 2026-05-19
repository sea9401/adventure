import { describe, expect, it } from "vitest";
import {
  QUEST_COMPLETION_DIRECT,
  QUEST_COMPLETION_GROUPS,
} from "./questCompletionData";
import { getQuestById } from "../data/quests";

// 데이터 자체가 클라(applyQuestCompletionSideEffects) + 서버(lib/server/questReward)
// 양쪽에서 source-of-truth. 잘못된 questId 가 들어가면 클라에선 조용히 fallthrough 하고
// 서버에선 group 판정이 영영 false 가 된다 — 가드.
describe("questCompletionData", () => {
  it("QUEST_COMPLETION_DIRECT 의 모든 questId 는 QUESTS 에 존재", () => {
    for (const id of Object.keys(QUEST_COMPLETION_DIRECT)) {
      expect(getQuestById(id), `unknown quest in DIRECT: ${id}`).toBeDefined();
    }
  });

  it("QUEST_COMPLETION_GROUPS 의 모든 members 는 QUESTS 에 존재", () => {
    for (const group of QUEST_COMPLETION_GROUPS) {
      for (const id of group.members) {
        expect(getQuestById(id), `unknown quest in GROUP: ${id}`).toBeDefined();
      }
    }
  });

  it("dustford-mujin-clear-road 는 oldwall_keep_unsealed 플래그를 set 한다 (EPIC #3-2 이전)", () => {
    const effects = QUEST_COMPLETION_DIRECT["dustford-mujin-clear-road"];
    expect(effects).toBeDefined();
    expect(effects).toContainEqual({
      kind: "setFlag",
      flag: "oldwall_keep_unsealed",
    });
  });
});
