"use client";

import { useEffect, useRef } from "react";
import type { RegionId } from "../data/world";
import type { OfflineSimResult } from "./offlineSim";

const STORAGE_KEY = "last-active-tick.v2";

type StoredTick = { regionId: RegionId; ts: number; active: boolean };

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
      // 구버전 데이터(v.0)에 active 없으면 false로 간주 — 사용자가 명시적으로 활성화하지 않은 한 시뮬 X.
      active: parsed.active === true,
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
  // 자리비운 시간(ms)을 받아 시뮬을 돌리고 결과를 반환. 호출 측에서 입력값을
  // 클로저에 가둬두기 좋다 (현재 player/potions/rules를 매번 새로 읽도록).
  runSim: (awayMs: number) => OfflineSimResult;
  // 시뮬 결과를 캐릭터/인벤토리/알림에 반영.
  onApply: (result: OfflineSimResult) => void;
};

// 트리거: "away → back" 사이클에서 sim 실행.
// "away" = 브라우저 탭 hidden  OR  in-app 으로 BattleView 가 아님(캐릭터/광장 등).
// 둘 중 하나라도 true 면 away. 둘 다 false (visible + 배틀뷰) 가 되면 복귀로 간주.
//   - 마운트 / dep 변경 시점엔 baseline 만 잡음. transition 없으면 시뮬 안 돌림.
//   - 사용자가 active=true 로 둔 채로 떠난 동안의 시간만 보상 적용.
export function useOfflineSimulation({
  enabled,
  regionId,
  active,
  isInBattleView,
  runSim,
  onApply,
}: OfflineSimulationOptions): void {
  const runSimRef = useRef(runSim);
  const onApplyRef = useRef(onApply);
  useEffect(() => {
    runSimRef.current = runSim;
    onApplyRef.current = onApply;
  });

  // 직전 사이클에서 "away" 였는지. null = 아직 baseline 안 잡힌 상태(최초 마운트).
  const wasAwayRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const computeAway = () =>
      document.visibilityState === "hidden" || !isInBattleView;

    const handleTransition = () => {
      const prev = wasAwayRef.current;
      const now = computeAway();
      if (prev === null) {
        // 최초 — baseline 만 잡고 끝.
        saveTick({ regionId, ts: Date.now(), active });
        wasAwayRef.current = now;
        return;
      }
      if (prev === now) return;
      wasAwayRef.current = now;
      if (now) {
        // 막 away 가 됨 — baseline 저장.
        saveTick({ regionId, ts: Date.now(), active });
        return;
      }
      // 복귀 — 저장된 baseline 으로 sim.
      const stored = loadTick();
      if (stored?.active && stored.regionId === regionId) {
        const awayMs = Date.now() - stored.ts;
        if (awayMs > 0) {
          const result = runSimRef.current(awayMs);
          if (result.battles > 0 || result.died) {
            onApplyRef.current(result);
          }
        }
      }
      saveTick({ regionId, ts: Date.now(), active });
    };

    // dep 변경(특히 isInBattleView 토글) 시점에 즉시 한 번 transition 검사.
    handleTransition();

    // 브라우저 탭 visibility 변화도 같은 로직으로 react.
    document.addEventListener("visibilitychange", handleTransition);
    return () => {
      document.removeEventListener("visibilitychange", handleTransition);
    };
  }, [enabled, regionId, active, isInBattleView]);
}
