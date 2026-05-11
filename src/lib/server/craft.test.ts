// craft 서버 lib 의 순수 계산(computeCraftOutcome) 검증. DB I/O(applyCraftAction)는
// 통합 테스트 인프라가 없어 제외 — 수동 시나리오(npm run dev + Network 탭)로 검증.

import { describe, expect, it } from "vitest";
import { CraftError, computeCraftOutcome, type CraftComputeInput } from "./craft";

const base = (): CraftComputeInput => ({
  potions: {},
  materials: {},
  equipment: {},
  craftedEquipment: {},
  potionCapacityBonus: 0,
  known: [],
});

// rollCraftTier(가중치 6/22/44/22/6, 누적 불량[0,6)/하급[6,28)/일반[28,72)/고급[72,94)/걸작[94,100)):
const rngMin = () => 0.0; // → 불량(-2)
const rngMid = () => 0.5; // → 일반(0)
const rngMax = () => 0.999; // → 걸작(2)

describe("computeCraftOutcome — 검증 실패", () => {
  it("없는 레시피 → unknown_recipe", () => {
    expect(() => computeCraftOutcome(base(), "nope")).toThrow(CraftError);
    try {
      computeCraftOutcome(base(), "nope");
    } catch (e) {
      expect((e as CraftError).code).toBe("unknown_recipe");
    }
  });

  it("안 익힌 제작서 → not_learned", () => {
    const input = { ...base(), materials: { branch: 5 } };
    try {
      computeCraftOutcome(input, "baseball_bat");
    } catch (e) {
      expect((e as CraftError).code).toBe("not_learned");
    }
  });

  it("재료 부족 → missing_material", () => {
    const input = { ...base(), known: ["baseball_bat"], materials: { branch: 1 } };
    try {
      computeCraftOutcome(input, "baseball_bat");
    } catch (e) {
      expect((e as CraftError).code).toBe("missing_material");
    }
  });

  it("equip 재료 부족 → missing_ingredient", () => {
    const input = {
      ...base(),
      known: ["nailed_baseball_bat"],
      materials: { rusty_nail: 99 },
      // baseball_bat 0개
    };
    try {
      computeCraftOutcome(input, "nailed_baseball_bat");
    } catch (e) {
      expect((e as CraftError).code).toBe("missing_ingredient");
    }
  });

  it("포션 가득 → potion_full", () => {
    const input = {
      ...base(),
      known: ["potion_heal_s"],
      materials: { slime_chunk: 9 },
      potions: { potion_heal_s: 999 },
    };
    try {
      computeCraftOutcome(input, "potion_heal_s");
    } catch (e) {
      expect((e as CraftError).code).toBe("potion_full");
    }
  });
});

describe("computeCraftOutcome — 장비 (등급 변동 있음)", () => {
  it("일반(tier 0) 결과는 equipment[] 로, 재료 차감", () => {
    const input = { ...base(), known: ["baseball_bat"], materials: { branch: 5 } };
    const out = computeCraftOutcome(input, "baseball_bat", rngMid);
    expect(out.result).toEqual({ kind: "equipment", itemId: "baseball_bat", tier: 0 });
    expect(out.equipment.baseball_bat).toBe(1);
    expect(out.craftedEquipment.baseball_bat).toBeUndefined();
    expect(out.materials.branch).toBe(3); // 5 - 2
  });

  it("비-기본 등급(불량) 결과는 craftedEquipment[id][tier] 로", () => {
    const input = { ...base(), known: ["baseball_bat"], materials: { branch: 2 } };
    const out = computeCraftOutcome(input, "baseball_bat", rngMin);
    expect(out.result).toEqual({ kind: "equipment", itemId: "baseball_bat", tier: -2 });
    expect(out.craftedEquipment.baseball_bat).toEqual({ "-2": 1 });
    expect(out.equipment.baseball_bat).toBeUndefined();
    expect(out.materials.branch).toBeUndefined(); // 2 - 2 = 0 → 정리됨
  });

  it("같은 등급 두 번째 제작은 카운트 누적", () => {
    const input = {
      ...base(),
      known: ["baseball_bat"],
      materials: { branch: 4 },
      craftedEquipment: { baseball_bat: { "2": 1 } },
    };
    const out = computeCraftOutcome(input, "baseball_bat", rngMax);
    expect(out.craftedEquipment.baseball_bat).toEqual({ "2": 2 });
  });

  it("equip 재료는 무등급(equipment) 먼저, 모자라면 낮은 등급부터 소비", () => {
    const input = {
      ...base(),
      known: ["nailed_baseball_bat"],
      materials: { rusty_nail: 28 },
      equipment: {},
      craftedEquipment: { baseball_bat: { "-1": 1, "2": 1 } },
    };
    const out = computeCraftOutcome(input, "nailed_baseball_bat", rngMid);
    // baseball_bat ×1 소비 — 낮은 등급("-1")부터 → "2" 만 남음
    expect(out.craftedEquipment.baseball_bat).toEqual({ "2": 1 });
    expect(out.result.kind).toBe("equipment");
    expect(out.materials.rusty_nail).toBeUndefined(); // 28 - 28 = 0
  });

  it("equip 재료 — 제작산이 다 떨어지면 드랍 고품질에서 소비", () => {
    const input = {
      ...base(),
      known: ["nailed_baseball_bat"],
      materials: { rusty_nail: 28 },
      equipment: {},
      craftedEquipment: {},
      droppedEquipment: { baseball_bat: { "1": 1, "2": 1 } },
    };
    const out = computeCraftOutcome(input, "nailed_baseball_bat", rngMid);
    // baseball_bat ×1 소비 — 낮은 품질("1")부터 → "2" 만 남음
    expect(out.droppedEquipment.baseball_bat).toEqual({ "2": 1 });
    expect(out.result.kind).toBe("equipment");
  });

  it("equip 재료 — equipment + droppedEquipment 합산이 모자라면 missing_ingredient", () => {
    const input = {
      ...base(),
      known: ["nailed_baseball_bat"],
      materials: { rusty_nail: 28 },
      droppedEquipment: { baseball_bat: {} },
    };
    expect(() => computeCraftOutcome(input, "nailed_baseball_bat", rngMid)).toThrow(
      /missing_ingredient/,
    );
  });
});

describe("computeCraftOutcome — 포션 (변동 없음)", () => {
  it("포션 결과는 항상 그대로, tier 개념 없음", () => {
    const input = { ...base(), known: ["potion_heal_s"], materials: { slime_chunk: 5 } };
    const out = computeCraftOutcome(input, "potion_heal_s", rngMax);
    expect(out.result).toEqual({ kind: "potion", potionId: "potion_heal_s", quantity: 1 });
    expect(out.potions.potion_heal_s).toBe(1);
    expect(out.materials.slime_chunk).toBe(2); // 5 - 3
  });
});
