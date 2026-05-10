"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRemoteSave } from "@/lib/storage/SaveProvider";
import type { RegionId } from "../data/world";
import type { OfflineSimResult } from "./offlineSim";

const STORAGE_KEY = "last-active-tick.v3";

type StoredTick = {
  regionId: RegionId;
  ts: number;
  active: boolean;
  /** baseline 시점의 player HP — 마을 회복 후 부풀린 HP 로 sim 안 되도록 (Fix #4). */
  playerHp: number;
  /** baseline 을 저장한 Clerk userId — 다른 계정 로그인 시 무시 (Fix #2). null = 로그인 정보 없음. */
  userId: string | null;
};

function loadTick(): StoredTick | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTick> | null;
    if (!parsed?.regionId || typeof parsed.ts !== "number") return null;
    return {
      regionId: parsed.regionId,
      ts: parsed.ts,
      active: parsed.active === true,
      playerHp:
        typeof parsed.playerHp === "number" && parsed.playerHp >= 0
          ? parsed.playerHp
          : 0,
      userId: typeof parsed.userId === "string" ? parsed.userId : null,
    };
  } catch {
    return null;
  }
}

function saveTick(tick: StoredTick): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tick));
  } catch {}
}

export type OfflineSimulationOptions = {
  // 시뮬 자체를 활성화할지. 아직 hydrate 안 됐거나 region에 적이 없으면 false.
  enabled: boolean;
  regionId: RegionId;
  // 사용자가 명시적으로 자동 사냥을 시작했는지(전투 시작 버튼 누름 후).
  // false이면 베이스라인만 갱신하고 시뮬은 돌리지 않는다.
  active: boolean;
  // 사용자가 현재 BattleView 화면에 있는지 (in-app 탭/서브뷰 기준).
  // false면 in-app 으로 다른 탭(캐릭터/광장 등)을 보는 상태 — 시뮬 대상.
  isInBattleView: boolean;
  /** baseline 박을 시점의 player HP. 마을 회복 익스플로잇 차단용. */
  playerHp: number;
  // baseline 의 region/HP 로 시뮬을 돌리고 결과를 반환. regionId 가 baseline 에 박혀
  // 있으므로 (현재 region 이 아니라) 그 시점에 사용자가 사냥하던 곳을 정확히 재현 —
  // 명시 중지 후 region 이동 시점에 호출돼도 옛 region 의 적·드롭 풀로 정상 보상.
  runSim: (
    awayMs: number,
    baselineHp: number,
    baselineRegionId: RegionId,
  ) => OfflineSimResult;
  // 시뮬 결과를 캐릭터/인벤토리/알림에 반영.
  onApply: (result: OfflineSimResult) => void;
};

export type OfflineSimulationHandle = {
  // 명시 중지 (사용자 토글 OFF / 모달 confirm 으로 region 이동 등) 직전에 호출.
  // 저장된 baseline 부터 지금까지의 시간을 한 번에 sim → 보상 적용 → baseline 갱신.
  // 이후 호출자가 setHuntingActive(false) / region 변경을 진행하면 그 시간만큼은
  // 정상 보상으로 잡혀있고, 새로 흐르는 시간은 OFF 상태라 sim 대상 아님.
  flushNow: () => void;
};

// 트리거: "away → back" 사이클에서 sim 실행.
// "away" = 브라우저 탭 hidden  OR  in-app 으로 BattleView 가 아님(캐릭터/광장 등).
// 둘 중 하나라도 true 면 away. 둘 다 false (visible + 배틀뷰) 가 되면 복귀로 간주.
//
// 최초 마운트(prev=null)에서 사용자가 이미 "back" 상태면 저장된 baseline 으로 즉시 sim.
// 이로써 (a) 탭 종료 후 재진입 (b) SaveProvider 의 60초 hidden 후 location.reload —
// 두 케이스 모두 다음 mount 에서 그 동안 흐른 시간만큼 보상 적용 (Fix #1, #2).
//
// baseline 의 userId/regionId 가 현재와 다르면 다른 계정/region 의 stale 데이터로 보고 무시.
// 회복 (현재 HP > baseline HP) 도 검출해 그 사이클은 sim skip — 마을에서 회복하고 돌아온
// 시간을 가짜 사냥으로 환산하지 않게 (Fix #4).
export function useOfflineSimulation({
  enabled,
  regionId,
  active,
  isInBattleView,
  playerHp,
  runSim,
  onApply,
}: OfflineSimulationOptions): OfflineSimulationHandle {
  // Clerk 세션 hydrate 전에 baseline 을 userId=null 로 잡으면 이후 valid check 실패.
  // isLoaded 까지 기다려서 일관된 userId 로만 baseline / sim 진행.
  const { userId, isLoaded: authLoaded } = useAuth();
  const remote = useRemoteSave();
  const runSimRef = useRef(runSim);
  const onApplyRef = useRef(onApply);
  const playerHpRef = useRef(playerHp);
  useEffect(() => {
    runSimRef.current = runSim;
    onApplyRef.current = onApply;
    playerHpRef.current = playerHp;
  });

  // 직전 사이클에서 "away" 였는지. null = 아직 baseline 안 잡힌 상태(최초 마운트).
  const wasAwayRef = useRef<boolean | null>(null);
  // sim 적용 직후 advance 할 baseline ts. 기록만 해두고 PATCH 큐가 saving→idle
  // 사이클을 한 번 거치면 그때 실제로 saveTick. PATCH 가 stale/error 로 끝나면
  // advance 하지 않아 다음 mount 에서 sim 이 같은 baseline 으로 재실행 → 보상 회복.
  const pendingAdvanceTsRef = useRef<number | null>(null);
  // 직전에 본 remote.status. saving→idle 전환을 검출해 advance 발화 (= flush 완료).
  const lastStatusKindRef = useRef(remote.status().kind);
  // flushNow 의 실제 구현 — 매 effect run 마다 최신 closure (regionId/active/userId
  // 의 현재 값) 을 캡처해 갱신. 외부 stable wrapper 가 이 ref 를 통해 호출.
  const flushNowImplRef = useRef<() => void>(() => {});

  // remote 큐가 saving→idle 로 정착하는 순간, 보류 중이던 baseline advance 적용.
  // saving 단계 없이 바로 idle 이 들어오면 (false-positive) advance 안 함 — 큐가
  // 실제로 한 사이클 돌았다는 증거가 saving 관찰.
  useEffect(() => {
    return remote.subscribe((s) => {
      const prev = lastStatusKindRef.current;
      lastStatusKindRef.current = s.kind;
      if (
        s.kind === "idle" &&
        prev === "saving" &&
        pendingAdvanceTsRef.current !== null
      ) {
        const ts = pendingAdvanceTsRef.current;
        pendingAdvanceTsRef.current = null;
        saveTick({
          regionId,
          ts,
          active,
          playerHp: playerHpRef.current,
          userId: userId ?? null,
        });
      }
    });
  }, [remote, regionId, active, userId]);

  useEffect(() => {
    if (!enabled || !authLoaded) return;

    const computeAway = () =>
      document.visibilityState === "hidden" || !isInBattleView;

    const isStoredValid = (stored: StoredTick | null): stored is StoredTick =>
      !!stored &&
      stored.active &&
      stored.regionId === regionId &&
      stored.userId === userId;

    // 반환값: sim 이 onApply 까지 갔으면 true. true 면 baseline advance 를 PATCH
    // 성공 후로 미뤄야 함 (보상 손실 차단).
    // baseline 의 regionId 를 그대로 runSim 에 전달 — 명시 중지 시 region 이 바뀌었어도
    // 사냥하던 그 region 의 적/드롭 풀로 시뮬.
    const trySimFromBaseline = (): boolean => {
      const stored = loadTick();
      if (!isStoredValid(stored)) return false;
      const awayMs = Date.now() - stored.ts;
      if (awayMs <= 0) return false;
      // 회복 검출 — 현재 HP 가 baseline 보다 높으면 마을 회복 등 비-사냥 이벤트 발생.
      // 그 사이클은 sim skip (가짜 HP 로 사냥 시뮬 방지).
      if (playerHpRef.current > stored.playerHp) return false;
      const result = runSimRef.current(awayMs, stored.playerHp, stored.regionId);
      if (result.battles > 0 || result.died) {
        onApplyRef.current(result);
        return true;
      }
      return false;
    };

    const writeBaselineNow = () => {
      // 보류 중이던 deferred advance 가 있다면 취소 — 더 최근 시점으로 즉시 덮어쓰니
      // 옛 ts 로 PATCH 성공 후 saveTick 하면 baseline 이 거꾸로 갈 수 있음.
      pendingAdvanceTsRef.current = null;
      saveTick({
        regionId,
        ts: Date.now(),
        active,
        playerHp: playerHpRef.current,
        userId: userId ?? null,
      });
    };

    // sim 결과를 적용한 직후 호출. 즉시 saveTick 하면 PATCH 가 409 등으로 실패
    // 했을 때 보상이 영원히 손실 — 대신 deferred 로 표시해 saving→idle 사이클
    // 한 번이 관찰되면 그때 advance.
    const writeBaselineDeferred = () => {
      pendingAdvanceTsRef.current = Date.now();
    };

    // 명시 중지 (사용자 토글 OFF / 모달 confirm 등) 직전에 호출하는 imperative entry.
    // baseline 이 유효하면 그 시점부터 지금까지 sim 적용 + advance, 무효면 그냥 새로 박음.
    // wasAwayRef 는 건드리지 않음 — 다음 visibility/dep 변경 사이클이 정상 트리거되도록.
    // 단, 사용자가 BattleView 에 머물던 중이면 (wasAwayRef===false) 실시간 엔진이
    // 이미 보상을 적용했으니 sim 안 돔 — 사망 직후 setHuntingActive(false) 같은
    // "안 떠나 있었던" 호출이 baseline 시점부터 흘러간 시간을 오프라인으로 가짜
    // 환산하는 double-count 차단.
    flushNowImplRef.current = () => {
      if (wasAwayRef.current !== true) {
        return;
      }
      const applied = trySimFromBaseline();
      if (applied) writeBaselineDeferred();
      else writeBaselineNow();
    };

    const handleTransition = () => {
      const prev = wasAwayRef.current;
      const now = computeAway();

      if (prev === null) {
        // 최초 — 사용자가 이미 "back" 상태면 옛 baseline 으로 즉시 sim.
        // away 상태라면 저장된 baseline 을 보존하고 다음 back 까지 대기 (없거나 무효면 새로 잡음).
        if (!now) {
          const applied = trySimFromBaseline();
          if (applied) writeBaselineDeferred();
          else writeBaselineNow();
        } else {
          const stored = loadTick();
          if (!isStoredValid(stored)) writeBaselineNow();
        }
        wasAwayRef.current = now;
        return;
      }

      if (prev === now) {
        // 전환 없음. 단, 여전히 away 인 채로 effect 가 re-run 됐다면 (regionId / active /
        // userId 같은 deps 가 바뀐 것) 저장된 baseline 의 stale 값으로 다음 복귀 시
        // sim 이 잘못 돌아가는 걸 막기 위해 baseline 을 현재 값으로 다시 쓴다.
        // 예: A 에서 사냥 ON → map 으로 → 지역 A→B (regionId 변경 + 부수효과로
        // active=false) → B→A → 배틀. 옛 baseline (A, true) 가 매치돼 의도치 않게
        // sim 이 실행되던 사고 차단. ts 도 now 로 리셋되므로 그 사이의 시간은 forfeit
        // (= "지역 변경 / 토글 OFF" 같은 명시 행동이 일어났으면 그 전 시간은 무효).
        if (now) writeBaselineNow();
        return;
      }
      wasAwayRef.current = now;

      if (now) {
        // 막 away 가 됨 — baseline 저장.
        writeBaselineNow();
        return;
      }
      // 복귀 — sim 시도. 적용했으면 advance 는 PATCH 성공 후로.
      const applied = trySimFromBaseline();
      if (applied) writeBaselineDeferred();
      else writeBaselineNow();
    };

    // dep 변경(특히 isInBattleView 토글) 시점에 즉시 한 번 transition 검사.
    handleTransition();

    // 브라우저 탭 visibility 변화도 같은 로직으로 react.
    document.addEventListener("visibilitychange", handleTransition);
    return () => {
      document.removeEventListener("visibilitychange", handleTransition);
      // cleanup 시 flushNow 도 noop 으로 — 언마운트 후 외부에서 호출되면 stale closure 가
      // 잘못된 region/active 로 saveTick 할 위험이 있음.
      flushNowImplRef.current = () => {};
    };
  }, [enabled, regionId, active, isInBattleView, userId, authLoaded]);

  // 외부 노출용 stable wrapper. 호출자는 매 render 마다 새 함수를 받지 않아 deps
  // 안정성이 보장됨 — 내부 ref 가 최신 closure 를 들고 있다.
  const flushNow = useCallback(() => {
    flushNowImplRef.current();
  }, []);

  return { flushNow };
}
