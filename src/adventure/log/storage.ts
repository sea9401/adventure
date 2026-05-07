export type MonsterLogEntry = {
  encountered: boolean;
  kills: number;
  firstSeenAt?: number;
  lastKilledAt?: number;
};

export type TownLogEntry = {
  visited: boolean;
  firstVisitedAt?: number;
  npcsTalkedTo: string[];
};

export type NpcLogEntry = {
  talkCount: number;
  firstTalkAt?: number;
};

export type AdventureLog = {
  monsters: Record<string, MonsterLogEntry>;
  towns: Record<string, TownLogEntry>;
  npcs: Record<string, NpcLogEntry>;
};

export const ADVENTURE_LOG_KEY = "adventure-log.v1";

export const emptyAdventureLog = (): AdventureLog => ({
  monsters: {},
  towns: {},
  npcs: {},
});

export function loadAdventureLog(): AdventureLog {
  if (typeof window === "undefined") return emptyAdventureLog();
  try {
    const raw = localStorage.getItem(ADVENTURE_LOG_KEY);
    if (!raw) return emptyAdventureLog();
    const parsed = JSON.parse(raw) as Partial<AdventureLog> | null;
    return {
      monsters: parsed?.monsters ?? {},
      towns: parsed?.towns ?? {},
      npcs: parsed?.npcs ?? {},
    };
  } catch {
    return emptyAdventureLog();
  }
}

export function saveAdventureLog(log: AdventureLog): void {
  try {
    localStorage.setItem(ADVENTURE_LOG_KEY, JSON.stringify(log));
  } catch {}
}
