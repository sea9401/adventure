"use client";

import { useCallback, useState } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import {
  emptyAdventureLog,
  type AdventureLog,
  type MonsterLogEntry,
} from "./storage";

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

function readInitial(raw: unknown): AdventureLog {
  if (!raw || typeof raw !== "object") return emptyAdventureLog();
  const parsed = raw as Partial<AdventureLog>;
  return {
    monsters: migrateMonsters(parsed.monsters ?? {}),
    towns: parsed.towns ?? {},
    npcs: parsed.npcs ?? {},
  };
}

export function useAdventureLog() {
  const initial = useSavedValue("adventure-log.v1");
  const [log, setLog] = useState<AdventureLog>(() => readInitial(initial));
  useRemotePatch("adventure-log.v1", log);

  const markEncountered = useCallback((monsterName: string) => {
    setLog((prev) => {
      const existing = prev.monsters[monsterName];
      if (existing?.encountered) return prev;
      return {
        ...prev,
        monsters: {
          ...prev.monsters,
          [monsterName]: {
            encountered: true,
            kills: existing?.kills ?? 0,
            firstSeenAt: existing?.firstSeenAt ?? Date.now(),
            lastKilledAt: existing?.lastKilledAt,
          },
        },
      };
    });
  }, []);

  const addKill = useCallback((monsterName: string) => {
    setLog((prev) => {
      const existing = prev.monsters[monsterName] ?? {
        encountered: true,
        kills: 0,
        firstSeenAt: Date.now(),
      };
      return {
        ...prev,
        monsters: {
          ...prev.monsters,
          [monsterName]: {
            ...existing,
            encountered: true,
            kills: existing.kills + 1,
            lastKilledAt: Date.now(),
          },
        },
      };
    });
  }, []);

  const markRegionVisited = useCallback((regionId: string) => {
    setLog((prev) => {
      const existing = prev.towns[regionId];
      if (existing?.visited) return prev;
      return {
        ...prev,
        towns: {
          ...prev.towns,
          [regionId]: {
            visited: true,
            firstVisitedAt: existing?.firstVisitedAt ?? Date.now(),
            npcsTalkedTo: existing?.npcsTalkedTo ?? [],
          },
        },
      };
    });
  }, []);

  const addTownNpcTalked = useCallback(
    (regionId: string, npcId: string) => {
      setLog((prev) => {
        const existing = prev.towns[regionId] ?? {
          visited: true,
          firstVisitedAt: Date.now(),
          npcsTalkedTo: [],
        };
        if (existing.npcsTalkedTo.includes(npcId)) return prev;
        return {
          ...prev,
          towns: {
            ...prev.towns,
            [regionId]: {
              ...existing,
              npcsTalkedTo: [...existing.npcsTalkedTo, npcId],
            },
          },
        };
      });
    },
    [],
  );

  const incrementNpcTalk = useCallback((npcId: string) => {
    setLog((prev) => {
      const existing = prev.npcs[npcId];
      return {
        ...prev,
        npcs: {
          ...prev.npcs,
          [npcId]: {
            talkCount: (existing?.talkCount ?? 0) + 1,
            firstTalkAt: existing?.firstTalkAt ?? Date.now(),
          },
        },
      };
    });
  }, []);

  return {
    log,
    hydrated: true,
    markEncountered,
    addKill,
    markRegionVisited,
    addTownNpcTalked,
    incrementNpcTalk,
  };
}
