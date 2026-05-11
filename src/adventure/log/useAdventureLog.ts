"use client";

import { useCallback, useState } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import {
  emptyAdventureLog,
  migrateMonsters,
  type AdventureLog,
} from "./storage";

function readInitial(raw: unknown): AdventureLog {
  if (!raw || typeof raw !== "object") return emptyAdventureLog();
  const parsed = raw as Partial<AdventureLog>;
  return {
    monsters: migrateMonsters(parsed.monsters ?? {}),
    towns: parsed.towns ?? {},
    npcs: parsed.npcs ?? {},
    titles: parsed.titles ?? {},
    battleLosses: parsed.battleLosses ?? 0,
    chatCount: parsed.chatCount ?? 0,
    healingCount: parsed.healingCount ?? 0,
  };
}

export function useAdventureLog() {
  const initial = useSavedValue("adventure-log.v2");
  const [log, setLog] = useState<AdventureLog>(() => readInitial(initial));
  useRemotePatch("adventure-log.v2", log);

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

  // 누적 패배 카운트 +1 — 칭호/통계용.
  const incrementBattleLosses = useCallback(() => {
    setLog((prev) => ({
      ...prev,
      battleLosses: (prev.battleLosses ?? 0) + 1,
    }));
  }, []);

  // 누적 채팅 발화 +1 — '수다쟁이' 칭호용.
  const incrementChatCount = useCallback(() => {
    setLog((prev) => ({
      ...prev,
      chatCount: (prev.chatCount ?? 0) + 1,
    }));
  }, []);

  // 누적 치료소 이용 +1 — '환자' 칭호용.
  const incrementHealingCount = useCallback(() => {
    setLog((prev) => ({
      ...prev,
      healingCount: (prev.healingCount ?? 0) + 1,
    }));
  }, []);

  // 칭호 획득 — 도감 등록은 "획득 시"가 트리거. 이미 등록된 경우 중복 무시.
  const markTitleObtained = useCallback((titleId: string) => {
    setLog((prev) => {
      if (prev.titles[titleId]) return prev;
      return {
        ...prev,
        titles: {
          ...prev.titles,
          [titleId]: { obtainedAt: Date.now() },
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
    markTitleObtained,
    incrementBattleLosses,
    incrementChatCount,
    incrementHealingCount,
  };
}
