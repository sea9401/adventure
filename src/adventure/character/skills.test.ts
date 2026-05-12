import { describe, it, expect } from "vitest";
import {
  skillLayout,
  deriveFeats,
  effectiveSkillNames,
  effectiveFeatName,
  FEAT_NAMES,
} from "./skills";
import type { StatKey } from "@/adventure/data/stats";

const ZERO: Record<StatKey, number> = {
  str: 0,
  dex: 0,
  vit: 0,
  spd: 0,
  luk: 0,
};

describe("skillLayout — 슬롯 해금", () => {
  it("기본: 일반 3칸, 특기 슬롯 없음", () => {
    expect(skillLayout({ level: 1, hasFlag: () => false })).toEqual({
      normalSlots: 3,
      hasFeatSlot: false,
    });
  });

  it("Lv40 도달 → 특기 슬롯 열림", () => {
    expect(
      skillLayout({ level: 40, hasFlag: () => false }).hasFeatSlot,
    ).toBe(true);
  });

  it("운봉의 거인 처치 → 레벨 무관 특기 슬롯 열림", () => {
    expect(
      skillLayout({
        level: 5,
        hasFlag: (id) => id === "peak_giant_defeated",
      }).hasFeatSlot,
    ).toBe(true);
  });

  it("5번째 일반 슬롯은 Lv65 AND 화산의 심장 처치 둘 다", () => {
    expect(skillLayout({ level: 65, hasFlag: () => false }).normalSlots).toBe(3);
    expect(
      skillLayout({
        level: 50,
        hasFlag: (id) => id === "volcano_heart_defeated",
      }).normalSlots,
    ).toBe(3);
    expect(
      skillLayout({
        level: 65,
        hasFlag: (id) => id === "volcano_heart_defeated",
      }).normalSlots,
    ).toBe(4);
  });
});

describe("deriveFeats — 두 요구 스탯 25 이상", () => {
  it("한쪽이 24면 미보유, 둘 다 25면 보유", () => {
    expect(
      deriveFeats({ ...ZERO, dex: 25, luk: 24 }).map((f) => f.name),
    ).not.toContain(FEAT_NAMES.LIFESTEAL);
    expect(
      deriveFeats({ ...ZERO, dex: 25, luk: 25 }).map((f) => f.name),
    ).toContain(FEAT_NAMES.LIFESTEAL);
  });
});

describe("effectiveSkillNames / effectiveFeatName — 슬롯 한도", () => {
  const skills = [
    { name: "A" },
    { name: "B" },
    { name: "C" },
    { name: "D" },
    { name: "E" },
  ];

  it("자동 채움은 slots 개까지", () => {
    expect(effectiveSkillNames(skills, undefined, 3)).toEqual(["A", "B", "C"]);
    expect(effectiveSkillNames(skills, undefined, 4)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("명시 선택도 slots 로 잘림 + 미보유 필터", () => {
    expect(effectiveSkillNames(skills, ["E", "D", "C", "B", "A"], 4)).toEqual([
      "E",
      "D",
      "C",
      "B",
    ]);
    expect(effectiveSkillNames(skills, ["없음", "A"], 3)).toEqual(["A"]);
  });

  it("특기 슬롯이 닫혀 있으면 effective feat 는 null", () => {
    const feats = [{ name: FEAT_NAMES.LIFESTEAL }];
    expect(effectiveFeatName(feats, FEAT_NAMES.LIFESTEAL, false)).toBeNull();
    expect(effectiveFeatName(feats, FEAT_NAMES.LIFESTEAL, true)).toBe(
      FEAT_NAMES.LIFESTEAL,
    );
    expect(effectiveFeatName(feats, "없는특기", true)).toBeNull();
    expect(effectiveFeatName(feats, undefined, true)).toBeNull();
  });
});
