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

export function loadCraftingState(): CraftingState {
  if (typeof window === "undefined") return emptyCraftingState();
  try {
    const raw = localStorage.getItem(CRAFTING_STORAGE_KEY);
    if (!raw) return emptyCraftingState();
    const parsed = JSON.parse(raw) as Partial<CraftingState> | null;
    const known = Array.isArray(parsed?.known) ? parsed!.known : [];
    return {
      known,
      crafted: Array.isArray(parsed?.crafted) ? parsed!.crafted : [],
      shareable: Array.isArray(parsed?.shareable) ? parsed!.shareable : [...known],
      boldQuestComplete: !!parsed?.boldQuestComplete,
      boldSlimeQuestComplete: !!parsed?.boldSlimeQuestComplete,
    };
  } catch {
    return emptyCraftingState();
  }
}

export function saveCraftingState(state: CraftingState): void {
  try {
    localStorage.setItem(CRAFTING_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}
