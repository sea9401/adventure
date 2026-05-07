"use client";

import { useCallback, useEffect, useState } from "react";
import {
  emptyAdventureLog,
  loadAdventureLog,
  saveAdventureLog,
  type AdventureLog,
} from "./storage";

export function useAdventureLog() {
  const [log, setLog] = useState<AdventureLog>(emptyAdventureLog);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLog(loadAdventureLog());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveAdventureLog(log);
  }, [hydrated, log]);

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

  const markTownVisited = useCallback((regionId: string) => {
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
    hydrated,
    markEncountered,
    addKill,
    markTownVisited,
    addTownNpcTalked,
    incrementNpcTalk,
  };
}
