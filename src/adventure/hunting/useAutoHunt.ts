"use client";

// 자동 사냥(타이머형 1시간 원정) 클라이언트 hook.
//
// dispatch → 서버가 huntBaselineAt=now 박음 (region/hp 는 서버가 map.v2/character.v2 에서 읽음).
// 1시간 카운트다운 후 collect → 서버가 simMs=min(경과,1시간) 만큼 sim·적용·종료 → 결과를
// sessionStorage 에 박고 reload (SaveProvider fresh hydrate + page.tsx 마운트 핸들러가 모달).
// 새로고침해도 mount 시 GET /api/hunt/status 로 카운트다운 복원.
//
// 라이브 "사냥 시작"(BattleView 화면 안 자동 전투)과 별개 — 그쪽은 page.tsx 의 useState.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AUTO_HUNT_DURATION_MS,
  AUTO_HUNT_RESULT_KEY,
} from "@/adventure/battle/autoHunt";
import type { OfflineSimResult } from "@/adventure/battle/offlineSim";
import type { AutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";

type StatusResponse =
  | { active: true; startedAt: string; regionId: string; durationMs: number }
  | { active: false };

type DispatchResponse =
  | { ok: true; startedAt: string; regionId: string; durationMs: number }
  | { ok: false; reason: string };

type CollectResponse =
  | { ok: true; noop: true; reason: string }
  | {
      ok: true;
      replayed?: true;
      hadReward: boolean;
      result: OfflineSimResult;
      died: boolean;
      simMs: number;
    };

export type AutoHuntState = "idle" | "active" | "complete";

export type AutoHuntHook = {
  /** "idle" = 안 보냄, "active" = 진행 중(1시간 안 지남), "complete" = 1시간 경과(수령 대기). */
  state: AutoHuntState;
  /** 위탁 진행 중 여부 (다른 곳에서 라이브 전투·보스 등 잠금 판정용). */
  isDispatched: boolean;
  /** 시작 시각 ms — 위탁 중이면 숫자, 아니면 null. */
  startedAtMs: number | null;
  /** 한 사이클 길이 ms. */
  durationMs: number;
  /** 남은 ms — active 면 양수, complete/idle 이면 0. */
  remainingMs: number;
  /** 위탁 사냥 지역 id — 위탁 중이면 문자열, 아니면 null. */
  regionId: string | null;
  /** 진행 중인 요청 있음 — 버튼 비활성화용. */
  busy: boolean;
  /** 보내기 — region 은 서버가 map.v2 에서 읽음. 실패 시 reason. */
  dispatch: () => Promise<{ ok: boolean; reason?: string }>;
  /** 수령 (조기 수령 겸용). 결과 있으면 reload. noop 이면 상태만 갱신. */
  collect: (playerName?: string) => Promise<void>;
};

export function useAutoHunt(opts?: {
  /** 디바이스별 자동 포션 룰 — collect 시 서버 sim 에 전달 (서버에 동기화 안 됨). */
  getAutoPotionRules?: () => AutoPotionConfig["rules"];
  /** collect 가 네트워크/HTTP 실패로 빈손 리턴할 때 호출 — 토스트 노출용. */
  onCollectError?: (message: string) => void;
}): AutoHuntHook {
  const { data: session, status } = useSession();
  const authLoaded = status !== "loading";
  const userId = session?.user?.id;
  const getRulesRef = useRef(opts?.getAutoPotionRules);
  const onCollectErrorRef = useRef(opts?.onCollectError);
  useEffect(() => {
    getRulesRef.current = opts?.getAutoPotionRules;
    onCollectErrorRef.current = opts?.onCollectError;
  });
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // 마운트 시 서버 상태 동기화 — 새로고침해도 카운트다운 복원.
  useEffect(() => {
    if (!authLoaded || !userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/hunt/status");
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (cancelled) return;
        if (data.active) {
          setStartedAtMs(new Date(data.startedAt).getTime());
          setRegionId(data.regionId || null);
          setNow(Date.now());
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoaded, userId]);

  // 위탁 중 1초마다 now 갱신 → 카운트다운 표시.
  useEffect(() => {
    if (startedAtMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAtMs]);

  const elapsed = startedAtMs !== null ? Math.max(0, now - startedAtMs) : 0;
  const remainingMs =
    startedAtMs !== null ? Math.max(0, AUTO_HUNT_DURATION_MS - elapsed) : 0;
  const state: AutoHuntState =
    startedAtMs === null ? "idle" : remainingMs > 0 ? "active" : "complete";

  const dispatch = useCallback(async (): Promise<{
    ok: boolean;
    reason?: string;
  }> => {
    if (busyRef.current) return { ok: false, reason: "busy" };
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/hunt/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) return { ok: false, reason: "http" };
      const data = (await res.json()) as DispatchResponse;
      if (data.ok) {
        setStartedAtMs(new Date(data.startedAt).getTime());
        setRegionId(data.regionId || null);
        setNow(Date.now());
        return { ok: true };
      }
      return { ok: false, reason: data.reason };
    } catch {
      return { ok: false, reason: "network" };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const collect = useCallback(async (playerName?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/hunt/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playerName,
          autoPotionRules: getRulesRef.current?.() ?? [],
        }),
      });
      if (!res.ok) {
        // 서버 5xx 등 — 그대로 끝내면 버튼이 다시 활성화되는데 사용자엔 아무 신호가
        // 없다. 토스트로 안내 (서버는 lastClaimResult 로 다음 시도에서 replay 가능).
        onCollectErrorRef.current?.(
          `위탁 결과 수령 실패 (HTTP ${res.status}) — 잠시 후 다시 시도해 주세요.`,
        );
        return;
      }
      const data = (await res.json()) as CollectResponse;
      if ("noop" in data) {
        // too_soon 외에는 위탁이 이미 해제된 상태 — 카운트다운 클리어.
        if (data.reason !== "too_soon") {
          setStartedAtMs(null);
          setRegionId(null);
        }
        return;
      }
      // 결과 있음 — sessionStorage 박고 reload.
      try {
        sessionStorage.setItem(
          AUTO_HUNT_RESULT_KEY,
          JSON.stringify(data.result),
        );
      } catch {}
      window.location.reload();
    } catch {
      // 네트워크 실패 — 토스트로 안내.
      onCollectErrorRef.current?.(
        "위탁 결과 수령 실패 — 통신 오류. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  return {
    state,
    isDispatched: startedAtMs !== null,
    startedAtMs,
    durationMs: AUTO_HUNT_DURATION_MS,
    remainingMs,
    regionId,
    busy,
    dispatch,
    collect,
  };
}
