import { describe, expect, it } from "vitest";
import { emptyAdventureLog } from "./storage";
import {
  COMPENDIUM_ENTRIES_PER_POINT,
  computeCompendiumReward,
  countCompendiumEntries,
} from "./compendiumReward";

function makeLog(over: {
  visitedRegions?: number;
  monstersKills?: number[];
  npcsTalked?: number;
  itemsDiscovered?: number;
  titlesObtained?: number;
  claimed?: number;
}) {
  const log = emptyAdventureLog();
  for (let i = 0; i < (over.visitedRegions ?? 0); i += 1) {
    log.towns[`region_${i}`] = { visited: true, npcsTalkedTo: [] };
  }
  (over.monstersKills ?? []).forEach((kills, i) => {
    log.monsters[`monster_${i}`] = { encountered: true, kills };
  });
  for (let i = 0; i < (over.npcsTalked ?? 0); i += 1) {
    log.npcs[`npc_${i}`] = { talkCount: 1 };
  }
  for (let i = 0; i < (over.itemsDiscovered ?? 0); i += 1) {
    log.discoveredEquipment![`item_${i}`] = { firstSeenAt: 0, variants: [] };
  }
  for (let i = 0; i < (over.titlesObtained ?? 0); i += 1) {
    log.titles[`title_${i}`] = { obtainedAt: 0 };
  }
  if (over.claimed !== undefined) log.compendiumPointsClaimed = over.claimed;
  return log;
}

describe("countCompendiumEntries", () => {
  it("빈 로그는 0", () => {
    expect(countCompendiumEntries(emptyAdventureLog()).total).toBe(0);
  });

  it("몬스터는 300킬 이상만 카운트", () => {
    const log = makeLog({ monstersKills: [299, 300, 1000, 5, 0] });
    expect(countCompendiumEntries(log).monsters).toBe(2); // 300, 1000
  });

  it("방문하지 않은 town 엔트리는 제외", () => {
    const log = emptyAdventureLog();
    log.towns["a"] = { visited: true, npcsTalkedTo: [] };
    log.towns["b"] = { visited: false, npcsTalkedTo: [] };
    expect(countCompendiumEntries(log).places).toBe(1);
  });

  it("카테고리 합계", () => {
    const log = makeLog({
      visitedRegions: 5,
      monstersKills: [300, 300, 0, 299],
      npcsTalked: 3,
      itemsDiscovered: 10,
      titlesObtained: 2,
    });
    const c = countCompendiumEntries(log);
    expect(c.places).toBe(5);
    expect(c.monsters).toBe(2);
    expect(c.npcs).toBe(3);
    expect(c.items).toBe(10);
    expect(c.titles).toBe(2);
    expect(c.total).toBe(5 + 2 + 3 + 10 + 2);
  });
});

describe("computeCompendiumReward", () => {
  it("20개 미만이면 available 0, toNext 가 남은 수", () => {
    const log = makeLog({ itemsDiscovered: 15 });
    const r = computeCompendiumReward(log);
    expect(r.counts.total).toBe(15);
    expect(r.earnedTotal).toBe(0);
    expect(r.available).toBe(0);
    expect(r.toNext).toBe(5);
  });

  it("정확히 20개 → +1 가용", () => {
    const log = makeLog({ itemsDiscovered: 20 });
    const r = computeCompendiumReward(log);
    expect(r.earnedTotal).toBe(1);
    expect(r.available).toBe(1);
    expect(r.toNext).toBe(COMPENDIUM_ENTRIES_PER_POINT);
  });

  it("이미 수령한 만큼은 available 에서 제외", () => {
    const log = makeLog({ itemsDiscovered: 60, claimed: 2 });
    const r = computeCompendiumReward(log);
    expect(r.earnedTotal).toBe(3);
    expect(r.claimed).toBe(2);
    expect(r.available).toBe(1);
  });

  it("claimed > earned 인 비정상 상태에서도 available 은 음수 안 됨", () => {
    const log = makeLog({ itemsDiscovered: 10, claimed: 5 });
    const r = computeCompendiumReward(log);
    expect(r.available).toBe(0);
  });
});
