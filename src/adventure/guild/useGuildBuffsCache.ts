"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGuildBuffs } from "./api";
import type { GuildBuffSlot } from "@/adventure/data/guildBuffs";

// 길드 버프 슬롯 캐시 — 전투 보상 계산 등에서 곱셈 배율을 즉시 꺼내 쓰기 위함.
// 패턴: 첫 mount + 주기 폴링 + 마스터의 변경 직후 refresh() 강제 호출.
// 비가입 멤버는 빈 배열 — 호출자는 길이 0 이어도 정상 동작.
const POLL_INTERVAL_MS = 60_000;

export type GuildBuffsCache = {
  buffs: GuildBuffSlot[];
  refresh: () => Promise<void>;
};

export function useGuildBuffsCache(): GuildBuffsCache {
  const [buffs, setBuffs] = useState<GuildBuffSlot[]>([]);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetchGuildBuffs();
      if (!mountedRef.current) return;
      setBuffs(r.guild?.buffs ?? []);
    } catch {
      // 네트워크 실패는 silent — 다음 폴링에서 회복.
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  return { buffs, refresh };
}
