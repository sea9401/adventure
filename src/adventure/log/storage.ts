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

// 칭호는 한 번 획득하면 끝 — 등록 시각만 기록.
export type TitleLogEntry = {
  obtainedAt: number;
};

export type AdventureLog = {
  monsters: Record<string, MonsterLogEntry>;
  towns: Record<string, TownLogEntry>;
  npcs: Record<string, NpcLogEntry>;
  titles: Record<string, TitleLogEntry>;
  /** 누적 전투 패배 횟수 — 칭호/통계용. */
  battleLosses?: number;
};

export const ADVENTURE_LOG_KEY = "adventure-log.v2";

// 몬스터 이름이 바뀌었을 때 기존 도감 데이터를 새 이름으로 옮기기 위한 매핑.
const MONSTER_RENAMES: Record<string, string> = {
  "호수 정령": "호수 님프",
};

function mergeMonsterEntries(
  a: MonsterLogEntry,
  b: MonsterLogEntry,
): MonsterLogEntry {
  return {
    encountered: a.encountered || b.encountered,
    kills: a.kills + b.kills,
    firstSeenAt:
      a.firstSeenAt !== undefined && b.firstSeenAt !== undefined
        ? Math.min(a.firstSeenAt, b.firstSeenAt)
        : (a.firstSeenAt ?? b.firstSeenAt),
    lastKilledAt:
      a.lastKilledAt !== undefined && b.lastKilledAt !== undefined
        ? Math.max(a.lastKilledAt, b.lastKilledAt)
        : (a.lastKilledAt ?? b.lastKilledAt),
  };
}

function migrateMonsters(
  monsters: Record<string, MonsterLogEntry>,
): Record<string, MonsterLogEntry> {
  const next: Record<string, MonsterLogEntry> = { ...monsters };
  for (const [oldName, newName] of Object.entries(MONSTER_RENAMES)) {
    const oldEntry = next[oldName];
    if (!oldEntry) continue;
    const existing = next[newName];
    next[newName] = existing
      ? mergeMonsterEntries(existing, oldEntry)
      : oldEntry;
    delete next[oldName];
  }
  return next;
}

export const emptyAdventureLog = (): AdventureLog => ({
  monsters: {},
  towns: {},
  npcs: {},
  titles: {},
  battleLosses: 0,
});

export function loadAdventureLog(): AdventureLog {
  if (typeof window === "undefined") return emptyAdventureLog();
  try {
    const raw = localStorage.getItem(ADVENTURE_LOG_KEY);
    if (!raw) return emptyAdventureLog();
    const parsed = JSON.parse(raw) as Partial<AdventureLog> | null;
    return {
      monsters: migrateMonsters(parsed?.monsters ?? {}),
      towns: parsed?.towns ?? {},
      npcs: parsed?.npcs ?? {},
      titles: parsed?.titles ?? {},
      battleLosses: parsed?.battleLosses ?? 0,
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
