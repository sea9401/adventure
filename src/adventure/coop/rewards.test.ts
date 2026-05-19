import { describe, expect, it } from "vitest";
import { computeCoopReward } from "./rewards";

// 2026-05-19: 7 스토리 코옵 보스(운봉의 거인 / 별을 지키는 자 / 천공인의 왕 / 창공의 주재 /
// 3 별빛 잔영) 솔로 region.boss 로 전환 — 그 보스들의 legend unique·칭호는 monster.drops·
// onDefeatTitleId 로 마이그레이션. 협동 보상 표는 dragon_nest 월드 보스 한 종만 남음.
describe("computeCoopReward — 월드 보스 (태고의 노룡) 한 종만", () => {
  it("미등록 보스 → 빈 보상 (스토리 7종은 모두 솔로 전환)", () => {
    for (const name of [
      "운봉의 거인",
      "별을 지키는 자",
      "천공인의 왕",
      "창공의 주재",
      "별빛 거인 잔영",
      "수심의 메아리",
      "성문지기 잔영",
      "없는보스",
    ]) {
      const r = computeCoopReward(name, "legend");
      expect(r.materials).toEqual({});
      expect(r.recipes).toEqual([]);
      expect(r.titleId).toBeUndefined();
      expect(r.equipRolls).toBeUndefined();
    }
  });

  it("태고의 노룡 — legend 시 칭호 + 5% primordial_regalia 굴림", () => {
    const r = computeCoopReward("태고의 노룡", "legend");
    expect(r.titleId).toBe("primordial_slayer");
    expect(r.equipRolls).toEqual([
      { itemId: "primordial_blade", chance: 0.2 },
      { itemId: "primordial_aegis", chance: 0.2 },
      { itemId: "primordial_helm", chance: 0.2 },
      { itemId: "primordial_cloak", chance: 0.15 },
      { itemId: "primordial_regalia", chance: 0.05 },
    ]);
  });

  it("태고의 노룡 — gold 누적 시 4 종 무기 굴림 + 재료", () => {
    const r = computeCoopReward("태고의 노룡", "gold");
    expect(r.materials.dragonscale_shard).toBe(6); // bronze 3 + gold 3
    expect(r.materials.bone_rune_steel).toBe(3); // silver 1 + gold 2
    expect(r.titleId).toBeUndefined();
  });
});
