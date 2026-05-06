// 건물 슬롯 — 도시 회관 레벨이 다른 건물의 상한을 정의

export const MAX_BUILDING_LEVEL_PER_HALL = 5;
export const TOWN_HALL_MAX = 20;
export const getMaxBuildingLevel = (townHall: number): number =>
  townHall * MAX_BUILDING_LEVEL_PER_HALL;

export const upgradeCost = (
  building: "farm" | "mine" | "inn" | "training" | "monument" | "townHall",
  currentLv: number,
): { gold: number; iron: number } => {
  const next = currentLv + 1;
  if (building === "farm") return { gold: 50 * next * next, iron: 0 };
  if (building === "inn") return { gold: 60 * next * next, iron: 10 * next };
  if (building === "training") return { gold: 80 * next * next, iron: 15 * next };
  if (building === "monument") return { gold: 800 * next * next, iron: 200 * next * next };
  if (building === "townHall")
    return { gold: 300 * next * next * next, iron: 80 * next * next * next };
  return { gold: 30 * next * next, iron: 20 * next * next };
};

// lv 100 까지는 L×50, 그 이후는 L×50 × (1 + (L-100)/15) 로 점진적 가속
// → lv 100→200 누적 약 3.5M EXP (직전까지의 ~4.7배). 후반 컨텐츠 페이스 길게.
