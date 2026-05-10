"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CoopRewardTier } from "./data";
import type { BattleLogEntry } from "@/adventure/battle/engine";

export type CoopSession = {
  id: string;
  regionId: string;
  bossName: string;
  hp: number;
  maxHp: number;
  spawnedAt: string;
  expiresAt: string;
  defeatedAt: string | null;
  nextSpawnAt: string | null;
  isActive: boolean;
};

export type CoopMyContribution = {
  damage: number;
  attackCount: number;
  ratio: number;
  tier: CoopRewardTier | null;
  cooldownEndsAt: string | null;
  claimable: boolean;
  claimedAt: string | null;
  claimedTier: CoopRewardTier | null;
};

export type CoopTopRow = {
  name: string;
  damage: number;
  attackCount: number;
  mine: boolean;
};

export type CoopAttackLogRow = {
  id: number;
  name: string;
  damageDealt: number;
  damageTaken: number;
  diedEarly: boolean;
  log: BattleLogEntry[];
  createdAt: string;
  mine: boolean;
};

export type CoopFetchResult = {
  session: CoopSession | null;
  myContribution: CoopMyContribution | null;
  top: CoopTopRow[];
  recentLogs: CoopAttackLogRow[];
};

export type CoopAttackResponse = {
  damageDealt: number;
  damageTaken: number;
  finalPlayerHp: number;
  diedEarly: boolean;
  log: BattleLogEntry[];
  session: { hp: number; defeated: boolean };
};

export type CoopClaimResponse = {
  tier: CoopRewardTier;
  ratio: number;
  reward: {
    materials: Record<string, number>;
    recipes: string[];
    recipeOneOf?: string[];
    recipeRolls?: { recipeId: string; chance: number }[];
    titleId?: string;
  };
};

const POLL_INTERVAL_MS = 5_000;

export function useCoopBoss(regionId: string, enabled: boolean) {
  const [data, setData] = useState<CoopFetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const cancelledRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    try {
      const r = await fetch(`/api/coop/${regionId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as CoopFetchResult;
      if (!cancelledRef.current) setData(json);
    } catch (e) {
      if (!cancelledRef.current) {
        setError(e instanceof Error ? e.message : "협동 보스 조회 실패");
      }
    }
  }, [regionId]);

  useEffect(() => {
    if (!enabled) return;
    cancelledRef.current = false;
    void fetchOnce();
    const id = setInterval(() => void fetchOnce(), POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, [enabled, fetchOnce]);

  const attack = useCallback(
    async (playerName: string): Promise<CoopAttackResponse | null> => {
      setWorking(true);
      setError(null);
      try {
        const r = await fetch(`/api/coop/${regionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "attack", playerName }),
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => `HTTP ${r.status}`);
          throw new Error(txt || `HTTP ${r.status}`);
        }
        const json = (await r.json()) as CoopAttackResponse;
        await fetchOnce();
        return json;
      } catch (e) {
        setError(e instanceof Error ? e.message : "공격 실패");
        return null;
      } finally {
        setWorking(false);
      }
    },
    [regionId, fetchOnce],
  );

  const claim = useCallback(async (): Promise<CoopClaimResponse | null> => {
    setWorking(true);
    setError(null);
    try {
      const r = await fetch(`/api/coop/${regionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => `HTTP ${r.status}`);
        throw new Error(txt || `HTTP ${r.status}`);
      }
      const json = (await r.json()) as CoopClaimResponse;
      await fetchOnce();
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "보상 수령 실패");
      return null;
    } finally {
      setWorking(false);
    }
  }, [regionId, fetchOnce]);

  return { data, error, working, attack, claim, refresh: fetchOnce };
}
