import { describe, expect, it } from "vitest";
import { ITEMS } from "@/adventure/data/items";
import { rehydrateEquippedItem } from "./rehydrateEquip";

// 회귀 테스트 — 과거 서버측 rehydrate 가 craftTier/dropQuality 를 무시하고 베이스만
// 돌려줘서, 걸작/빼어난 장비를 낀 빌드의 feat(흡혈 등)이 위탁 사냥에서 침묵 비활성화됐다.
// 공용 헬퍼 rehydrateEquippedItem 이 두 marker 모두 반영하도록 보장한다.
describe("rehydrateEquippedItem", () => {
  const baseId = "bandit_dagger"; // bonus: { atk: 4, dex: 2 }, variance 있는 제작산 후보.

  it("null/undefined 입력은 null", () => {
    expect(rehydrateEquippedItem(null)).toBeNull();
    expect(rehydrateEquippedItem(undefined)).toBeNull();
  });

  it("이름 매칭 실패면 null (아이템 삭제·rename 케이스)", () => {
    const ghost = { ...ITEMS[baseId], name: "그런아이템없음" };
    expect(rehydrateEquippedItem(ghost)).toBeNull();
  });

  it("craftTier/dropQuality 없는 일반 인스턴스는 베이스로 교체", () => {
    const saved = ITEMS[baseId];
    const re = rehydrateEquippedItem(saved);
    expect(re).not.toBeNull();
    expect(re!.bonus).toEqual(ITEMS[baseId].bonus);
  });

  it("craftTier 마커가 있으면 등급 반영본을 돌려준다 (마커 + 베이스 이상)", () => {
    const base = ITEMS[baseId];
    const saved = { ...base, craftTier: 2 as const };
    const re = rehydrateEquippedItem(saved);
    expect(re).not.toBeNull();
    expect(re!.craftTier).toBe(2);
    // 베이스가 atk/dex 만 가지므로 둘만 비교. variance 정의가 있으면 크고, 없으면 같다.
    const bonus = (re!.bonus ?? {}) as Record<string, number | undefined>;
    const baseBonus = (base.bonus ?? {}) as Record<string, number | undefined>;
    expect(bonus.atk ?? 0).toBeGreaterThanOrEqual(baseBonus.atk ?? 0);
    expect(bonus.dex ?? 0).toBeGreaterThanOrEqual(baseBonus.dex ?? 0);
  });

  it("dropQuality 마커가 있으면 그 등급 반영본을 돌려준다", () => {
    const base = ITEMS[baseId];
    const saved = { ...base, dropQuality: 2 as const };
    const re = rehydrateEquippedItem(saved);
    expect(re).not.toBeNull();
    expect(re!.dropQuality).toBe(2);
    const bonus = (re!.bonus ?? {}) as Record<string, number | undefined>;
    const baseBonus = (base.bonus ?? {}) as Record<string, number | undefined>;
    expect(bonus.atk ?? 0).toBeGreaterThanOrEqual(baseBonus.atk ?? 0);
    expect(bonus.dex ?? 0).toBeGreaterThanOrEqual(baseBonus.dex ?? 0);
  });
});
