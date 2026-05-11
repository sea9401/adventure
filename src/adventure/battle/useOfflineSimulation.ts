"use client";

// 오프라인 사냥 클라이언트 hook — 서버 권위 모델.
//
// 옛 흐름: 클라가 baseline 을 localStorage 에 박고, 복귀 시 simulateOfflineHunt 를
// 클라에서 돌려 onApply 로 캐릭터/인벤토리 갱신 → PATCH 큐로 서버 동기화. PATCH
// 실패 시 보상 손실 (audit #2). outbox/deferred advance/saving→idle subscriber 등의
// 보완책이 누적돼 복잡도 폭증.
//
// 새 흐름: 서버가 baseline 을 users 컬럼에 보관하고 sim·적용·advance 를 트랜잭션
// 안에서 처리. 클라는 trigger 시점에 API 호출만 하고, hadReward 이면 결과를
// sessionStorage 에 박아 reload — reload 후 mount-time handler 가 모달 표시.
//
// API:
//   - POST /api/offline-hunt/start  사냥 토글 ON (baseline=NOW, hp/region 서버측 자동)
//   - POST /api/offline-hunt/claim  복귀 감지 시 (sim + 보상 + baseline advance)
//   - POST /api/offline-hunt/end    토글 OFF / 사망 / region 이동 (sim + 보상 + active=false)
//
// Reload 정책: hadReward=true 일 때만 reload. 짧은 alt-tab (<10초) 은 서버가 noop
// 반환 → 클라도 silent. 사용자가 결과 모달을 봐야 할 때만 reload UX 발생.

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import type { OfflineSimResult } from "./offlineSim";
import type { AutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";

// reload 후 모달을 띄우기 위한 sessionStorage 키. mount-time handler 가 읽고 삭제.
export const OFFLINE_REWARD_PENDING_KEY = "offline-reward-pending.v2";
// 일회성 마이그레이션 marker. 옛 키 (last-active-tick.v3, offline-reward-pending.v1)
// 정리는 한 번만.
const MIGRATED_MARKER_KEY = "offline-migrated.v2";

type ClaimResponse = {
  ok: boolean;
  hadReward?: boolean;
  noop?: boolean;
  reason?: string;
  result?: OfflineSimResult;
};

// 한 사이클 동안 사용할 claimId 생성. crypto.randomUUID 가 있으면 사용, 없으면 fallback.
function newClaimId(): string {
  const c = typeof crypto !== "undefined" ? crypto : null;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
): Promise<ClaimResponse | null> {
  try {
    const sessionId =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("session-id")
        : null;
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (sessionId) headers["x-session-id"] = sessionId;
    const res = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // 410 (session_invalidated) 은 SaveProvider 의 다른 경로가 이미 잡고 처리 중.
      // 그 외 5xx 등은 silent 실패 — 다음 trigger 에서 재시도되도록.
      return null;
    }
    return (await res.json()) as ClaimResponse;
  } catch {
    return null;
  }
}

export type OfflineSimulationOptions = {
  // hook 활성화 여부 — 지역에 적이 없거나 hydrate 안 됐으면 false.
  enabled: boolean;
  // 자동 사냥 토글 (사용자 의도).
  active: boolean;
  // 사용자가 현재 BattleView 화면에 있는지. away→back 판정에 사용.
  isInBattleView: boolean;
  // 현재 region — /claim 응답 후 server 의 baseline.region 을 이 값으로 advance.
  // map 이동 후 새 region 에서 다음 사이클이 정상적으로 그 region 으로 잡히게.
  regionId: string;
  // 클라 측 자동 포션 룰 — 서버 sim 에 전달 (디바이스별 설정이라 서버 sync 안 됨).
  // 함수 형태로 받아 매 호출마다 최신 값 캡처.
  getAutoPotionRules: () => AutoPotionConfig["rules"];
  // 사용자 이름 — 전투 로그에 사용.
  playerName: string;
};

export type OfflineSimulationHandle = {
  // 명시 종료 — 사용자 토글 OFF, region 이동, 사망 등에서 호출.
  // 트랜잭션으로 sim 적용 + active=false. hadReward 시 reload.
  flushNow: () => void;
};

export function useOfflineSimulation({
  enabled,
  active,
  isInBattleView,
  regionId,
  getAutoPotionRules,
  playerName,
}: OfflineSimulationOptions): OfflineSimulationHandle {
  const { isLoaded: authLoaded } = useAuth();

  // 매 effect run 마다 최신값을 ref 에 담아 listener 안에서 stale closure 회피.
  const activeRef = useRef(active);
  const isInBattleViewRef = useRef(isInBattleView);
  const playerNameRef = useRef(playerName);
  const regionIdRef = useRef(regionId);
  const getRulesRef = useRef(getAutoPotionRules);
  useEffect(() => {
    activeRef.current = active;
    isInBattleViewRef.current = isInBattleView;
    playerNameRef.current = playerName;
    regionIdRef.current = regionId;
    getRulesRef.current = getAutoPotionRules;
  });

  // 직전에 본 active 값 — false→true 전환 검출. null = 아직 한 번도 안 본 상태.
  const lastSeenActiveRef = useRef<boolean | null>(null);
  // 직전에 본 away 상태 — away→back 전환 시 /claim.
  const lastAwayRef = useRef<boolean | null>(null);
  // 동시에 여러 trigger 가 한 사이클에 발화하지 않도록 in-flight 가드.
  const inFlightRef = useRef(false);

  // hadReward 결과 처리 — sessionStorage 박고 reload.
  // 짧은 noop 은 silent return.
  const handleResult = useCallback((res: ClaimResponse | null) => {
    if (!res || !res.ok) return;
    if (!res.hadReward || !res.result) return;
    try {
      sessionStorage.setItem(
        OFFLINE_REWARD_PENDING_KEY,
        JSON.stringify(res.result),
      );
    } catch {}
    // 사망 시 hunting 토글도 OFF 로 — reload 후 useHuntingState 가 sessionStorage 에서 읽음.
    if (res.result.died) {
      try {
        sessionStorage.setItem("hunting-active", "false");
      } catch {}
    }
    // reload — SaveProvider 가 fresh hydrate 되어 새 character/inventory/version 적용.
    location.reload();
  }, []);

  const callClaim = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await postJson("/api/offline-hunt/claim", {
        claimId: newClaimId(),
        autoPotionRules: getRulesRef.current(),
        playerName: playerNameRef.current,
        currentRegion: regionIdRef.current,
      });
      handleResult(res);
    } finally {
      inFlightRef.current = false;
    }
  }, [handleResult]);

  const callEnd = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await postJson("/api/offline-hunt/end", {
        claimId: newClaimId(),
        autoPotionRules: getRulesRef.current(),
        playerName: playerNameRef.current,
      });
      handleResult(res);
    } finally {
      inFlightRef.current = false;
    }
  }, [handleResult]);

  const callStart = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await postJson("/api/offline-hunt/start", {});
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // 일회성 마이그레이션 — 옛 키 정리. SaveProvider 부트 후 한 번만.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(MIGRATED_MARKER_KEY)) return;
      localStorage.removeItem("last-active-tick.v3");
      localStorage.removeItem("offline-reward-pending.v1");
      localStorage.setItem(MIGRATED_MARKER_KEY, "1");
    } catch {}
  }, []);

  // 메인 effect — active 전환 + away/back 전환 처리.
  useEffect(() => {
    if (!enabled || !authLoaded) return;

    const computeAway = () =>
      document.visibilityState === "hidden" || !isInBattleViewRef.current;

    const lastActive = lastSeenActiveRef.current;
    lastSeenActiveRef.current = active;

    // 초기 마운트 — active=true 면 즉시 /claim. /claim 이 noop(inactive) 반환하면
    // 첫 사이클이라는 뜻이라 /start 로 baseline 박음.
    if (lastActive === null) {
      lastAwayRef.current = computeAway();
      if (active) {
        (async () => {
          if (inFlightRef.current) return;
          inFlightRef.current = true;
          try {
            const claimRes = await postJson("/api/offline-hunt/claim", {
              claimId: newClaimId(),
              autoPotionRules: getRulesRef.current(),
              playerName: playerNameRef.current,
              currentRegion: regionIdRef.current,
            });
            handleResult(claimRes);
            // claim 응답이 inactive noop 이면 서버에 baseline 없음 → /start.
            if (
              claimRes &&
              claimRes.ok &&
              claimRes.noop &&
              claimRes.reason === "inactive"
            ) {
              await postJson("/api/offline-hunt/start", {});
            }
          } finally {
            inFlightRef.current = false;
          }
        })();
      }
      return;
    }

    // false → true 전환: /start.
    if (!lastActive && active) {
      void callStart();
      lastAwayRef.current = computeAway();
      return;
    }

    // true → false 전환: hunting.setFlushHandler → flushNow 가 이미 /end 처리.
    // 여기서는 아무 것도 안 함 — 중복 호출 방지.
    // (직접 setActiveRaw 로 false 가 된 경우엔 /end 호출이 빠지는데, 그 경로는
    //  사망 후처리 등 server 가 이미 active=false 상태인 케이스라 안전.)

    lastAwayRef.current = computeAway();
  }, [enabled, authLoaded, active, callStart, handleResult]);

  // visibility / isInBattleView 변화로 away → back 전환 검출 → /claim.
  useEffect(() => {
    if (!enabled || !authLoaded) return;

    const onTransition = () => {
      const prev = lastAwayRef.current;
      const now =
        document.visibilityState === "hidden" || !isInBattleViewRef.current;
      lastAwayRef.current = now;
      if (prev === null) return;
      if (prev === now) return;
      // away → back + active=true 일 때만 /claim.
      if (!now && activeRef.current) {
        void callClaim();
      }
    };

    // isInBattleView 가 props 로 변했을 수도 — 즉시 한 번 검사.
    onTransition();

    document.addEventListener("visibilitychange", onTransition);
    return () => {
      document.removeEventListener("visibilitychange", onTransition);
    };
  }, [enabled, authLoaded, isInBattleView, callClaim]);

  const flushNow = useCallback(() => {
    void callEnd();
  }, [callEnd]);

  return { flushNow };
}
