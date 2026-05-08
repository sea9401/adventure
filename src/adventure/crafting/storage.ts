export type CraftingState = {
  known: string[];
  crafted: string[];
  boldQuestComplete: boolean;
  boldSlimeQuestComplete: boolean;
};

export const CRAFTING_STORAGE_KEY = "crafting.v2";

export const emptyCraftingState = (): CraftingState => ({
  known: [],
  crafted: [],
  boldQuestComplete: false,
  boldSlimeQuestComplete: false,
});

export function loadCraftingState(): CraftingState {
  if (typeof window === "undefined") return emptyCraftingState();
  try {
    const raw = localStorage.getItem(CRAFTING_STORAGE_KEY);
    if (!raw) return emptyCraftingState();
    const parsed = JSON.parse(raw) as Partial<CraftingState> | null;
    return {
      known: Array.isArray(parsed?.known) ? parsed!.known : [],
      crafted: Array.isArray(parsed?.crafted) ? parsed!.crafted : [],
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
