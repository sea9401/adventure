export type CraftingState = {
  known: string[];
  crafted: string[];
  // 거래소/우편 공유 토큰 — 학습 시점에 1개 부여, 공유 시 소비, 다시 습득하면 충전.
  // 누락된 경우(레거시 저장본) known 을 복사해 풀 토큰 상태로 시작.
  shareable: string[];
  boldQuestComplete: boolean;
  boldSlimeQuestComplete: boolean;
};

export const CRAFTING_STORAGE_KEY = "crafting.v2";

export const emptyCraftingState = (): CraftingState => ({
  known: [],
  crafted: [],
  shareable: [],
  boldQuestComplete: false,
  boldSlimeQuestComplete: false,
});
