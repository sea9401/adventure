export type QuestState = "available" | "active" | "ready" | "completed";

export type QuestProgressEntry = {
  state: QuestState;
  progress: number;
  completedCount: number;
  lastCompletedAt?: number;
};

export type QuestProgressMap = Record<string, QuestProgressEntry>;

export const QUEST_PROGRESS_KEY = "quest-progress.v2";

export function defaultQuestEntry(): QuestProgressEntry {
  return { state: "available", progress: 0, completedCount: 0 };
}

export function loadQuestProgress(): QuestProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(QUEST_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as QuestProgressMap | null;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function saveQuestProgress(map: QuestProgressMap): void {
  try {
    localStorage.setItem(QUEST_PROGRESS_KEY, JSON.stringify(map));
  } catch {}
}
