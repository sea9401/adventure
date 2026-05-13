import { describe, expect, it, vi } from "vitest";
import { applyQuestReward, type RewardServices } from "./applyReward";

function makeServices() {
  return {
    addPotion: vi.fn(),
    addMaterial: vi.fn(),
    addEquipment: vi.fn(),
    learnRecipe: vi.fn(),
    addGoldFame: vi.fn(),
    addExp: vi.fn(),
    addPotionCapacity: vi.fn(),
  } satisfies RewardServices;
}

describe("applyQuestReward", () => {
  it("빈 보상은 아무것도 호출하지 않고 빈 요약 반환", () => {
    const s = makeServices();
    const tokens = applyQuestReward({}, s);
    expect(tokens).toEqual([]);
    expect(s.addPotion).not.toHaveBeenCalled();
    expect(s.addGoldFame).not.toHaveBeenCalled();
  });

  it("gold/fame이 둘 다 양수일 때 addGoldFame 한 번만 호출", () => {
    const s = makeServices();
    const tokens = applyQuestReward({ gold: 10, fame: 2 }, s);
    expect(s.addGoldFame).toHaveBeenCalledTimes(1);
    expect(s.addGoldFame).toHaveBeenCalledWith(10, 2);
    expect(tokens).toEqual(["골드 +10", "명성 +2"]);
  });

  it("gold/fame이 0이면 addGoldFame 호출 안 함", () => {
    const s = makeServices();
    applyQuestReward({ gold: 0, fame: 0 }, s);
    expect(s.addGoldFame).not.toHaveBeenCalled();
  });

  it("포션 보상은 종류별로 addPotion 호출 + 카운트>1이면 ×n 표기", () => {
    const s = makeServices();
    const tokens = applyQuestReward(
      { potions: [{ id: "potion_heal_s", count: 5 }] },
      s,
    );
    expect(s.addPotion).toHaveBeenCalledWith("potion_heal_s", 5);
    expect(tokens).toEqual(["작은 회복약 ×5"]);
  });

  it("아이템 보상은 카운트만큼 addEquipment 반복 호출", () => {
    const s = makeServices();
    const tokens = applyQuestReward(
      { items: [{ id: "vitality_ring", count: 1 }] },
      s,
    );
    expect(s.addEquipment).toHaveBeenCalledTimes(1);
    expect(s.addEquipment).toHaveBeenCalledWith("vitality_ring");
    expect(tokens).toEqual(["활력의 반지"]);
  });

  it("recipes는 learnRecipe + 제작서 이름으로 요약", () => {
    const s = makeServices();
    const tokens = applyQuestReward({ recipes: ["potion_heal_s_dust"] }, s);
    expect(s.learnRecipe).toHaveBeenCalledWith("potion_heal_s_dust");
    expect(tokens).toEqual(["작은 회복약 — 가루 공정"]);
  });

  it("EXP 보상은 addExp 호출 + 'EXP +n' 토큰", () => {
    const s = makeServices();
    const tokens = applyQuestReward({ exp: 10 }, s);
    expect(s.addExp).toHaveBeenCalledWith(10);
    expect(tokens).toEqual(["EXP +10"]);
  });

  it("EXP가 0이면 addExp 호출 안 함", () => {
    const s = makeServices();
    applyQuestReward({ exp: 0 }, s);
    expect(s.addExp).not.toHaveBeenCalled();
  });

  it("신참 보너스 — playerLevel < 8 면 EXP ×2 + 표기에 (신참 ×2)", () => {
    const s = makeServices();
    const tokens = applyQuestReward({ exp: 50 }, s, { playerLevel: 3 });
    expect(s.addExp).toHaveBeenCalledWith(100);
    expect(tokens).toEqual(["EXP +100 (신참 ×2)"]);
  });

  it("신참 보너스 — playerLevel >= 8 면 미적용", () => {
    const s = makeServices();
    const tokens = applyQuestReward({ exp: 50 }, s, { playerLevel: 8 });
    expect(s.addExp).toHaveBeenCalledWith(50);
    expect(tokens).toEqual(["EXP +50"]);
  });

  it("신참 보너스 — playerLevel 미지정 시 미적용 (기본 동작 유지)", () => {
    const s = makeServices();
    const tokens = applyQuestReward({ exp: 50 }, s);
    expect(s.addExp).toHaveBeenCalledWith(50);
    expect(tokens).toEqual(["EXP +50"]);
  });

  it("potionCapacityBonus는 addPotionCapacity 호출 + '+n' 토큰", () => {
    const s = makeServices();
    const tokens = applyQuestReward({ potionCapacityBonus: 1 }, s);
    expect(s.addPotionCapacity).toHaveBeenCalledWith(1);
    expect(tokens).toEqual(["포션 최대 보유량 +1"]);
  });

  it("복합 보상은 정의 순서대로 토큰을 합성", () => {
    const s = makeServices();
    const tokens = applyQuestReward(
      {
        gold: 5,
        fame: 1,
        exp: 10,
        potions: [{ id: "potion_heal_s", count: 5 }],
        recipes: ["potion_heal_s_dust"],
      },
      s,
    );
    expect(tokens).toEqual([
      "골드 +5",
      "명성 +1",
      "EXP +10",
      "작은 회복약 ×5",
      "작은 회복약 — 가루 공정",
    ]);
  });
});
