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

// 두 entry 중 "더 진행된" 쪽 판정 — completedCount → state rank → progress → lastCompletedAt 순.
// 서버 동기화 실패(409 drop 등)로 일시적으로 서버에 반영 안 된 진행이 있을 때
// localStorage 백업이 보존한 더 진행된 상태를 우선 적용하기 위함.
const STATE_RANK: Record<QuestState, number> = {
  available: 0,
  active: 1,
  ready: 2,
  completed: 3,
};

function isMoreProgressed(
  a: QuestProgressEntry,
  b: QuestProgressEntry,
): boolean {
  if (a.completedCount !== b.completedCount)
    return a.completedCount > b.completedCount;
  if (STATE_RANK[a.state] !== STATE_RANK[b.state])
    return STATE_RANK[a.state] > STATE_RANK[b.state];
  if (a.progress !== b.progress) return a.progress > b.progress;
  return (a.lastCompletedAt ?? 0) > (b.lastCompletedAt ?? 0);
}

// 서버 + 로컬 백업 머지. per-key 로 더 진행된 entry 채택.
// 서버에만 있는 키는 그대로, 로컬에만 있는 키는 살림.
export function mergeQuestProgress(
  remote: QuestProgressMap,
  local: QuestProgressMap,
): QuestProgressMap {
  const merged: QuestProgressMap = { ...remote };
  for (const [id, localEntry] of Object.entries(local)) {
    const remoteEntry = merged[id];
    if (!remoteEntry) {
      merged[id] = localEntry;
      continue;
    }
    if (isMoreProgressed(localEntry, remoteEntry)) {
      merged[id] = localEntry;
    }
  }
  return merged;
}
