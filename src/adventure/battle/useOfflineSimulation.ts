"use client";

import { useEffect, useRef } from "react";
import type { RegionId } from "../data/world";
import type { OfflineSimResult } from "./offlineSim";

const STORAGE_KEY = "last-active-tick.v1";

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
  // 자리비운 시간(ms)을 받아 시뮬을 돌리고 결과를 반환. 호출 측에서 입력값을
  // 클로저에 가둬두기 좋다 (현재 player/potions/rules를 매번 새로 읽도록).
  runSim: (awayMs: number) => OfflineSimResult;
  // 시뮬 결과를 캐릭터/인벤토리/알림에 반영.
  onApply: (result: OfflineSimResult) => void;
};

// 트리거 두 가지:
//   1. mount/region/active 변경 시: 저장된 tick이 active=true && 같은 region이면 시뮬
//   2. document visibility hidden→visible 전환 시: 동일 흐름
// active 여부와 관계없이 baseline 저장은 항상 — 다음 active 진입 시 측정 정확도 유지.
export function useOfflineSimulation({
  enabled,
  regionId,
  active,
  runSim,
  onApply,
}: OfflineSimulationOptions): void {
  const runSimRef = useRef(runSim);
  const onApplyRef = useRef(onApply);
  useEffect(() => {
    runSimRef.current = runSim;
    onApplyRef.current = onApply;
  });

  useEffect(() => {
    if (!enabled) return;

    const tryReplay = () => {
      const stored = loadTick();
      // 직전 세션이 active=true이고 같은 region에 있을 때만 시뮬.
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

    tryReplay();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        saveTick({ regionId, ts: Date.now(), active });
      } else if (document.visibilityState === "visible") {
        tryReplay();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, regionId, active]);
}
