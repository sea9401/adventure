"use client";

import { useEffect, useRef } from "react";
import type { RegionId } from "../data/world";
import type { OfflineSimResult } from "./offlineSim";

const STORAGE_KEY = "last-active-tick.v1";

type StoredTick = { regionId: RegionId; ts: number };

function loadTick(): StoredTick | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTick> | null;
    if (!parsed?.regionId || typeof parsed.ts !== "number") return null;
    return { regionId: parsed.regionId, ts: parsed.ts };
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
  // 자리비운 시간(ms)을 받아 시뮬을 돌리고 결과를 반환. 호출 측에서 입력값을
  // 클로저에 가둬두기 좋다 (현재 player/potions/rules를 매번 새로 읽도록).
  runSim: (awayMs: number) => OfflineSimResult;
  // 시뮬 결과를 캐릭터/인벤토리/알림에 반영.
  onApply: (result: OfflineSimResult) => void;
};

// 트리거 두 가지:
//   1. mount/region 변경 시: 저장된 lastTickAt이 같은 region이면 시뮬 → lastTick 갱신
//   2. document visibility hidden→visible 전환 시: 동일 흐름
// 또한 visible→hidden 시점에도 lastTick을 즉시 갱신해 다음 복귀 때 정확히 측정.
export function useOfflineSimulation({
  enabled,
  regionId,
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
      if (stored && stored.regionId === regionId) {
        const awayMs = Date.now() - stored.ts;
        if (awayMs > 0) {
          const result = runSimRef.current(awayMs);
          if (result.battles > 0 || result.died) {
            onApplyRef.current(result);
          }
        }
      }
      saveTick({ regionId, ts: Date.now() });
    };

    // mount + region 진입 시 한 번 시뮬 (있으면) + 새 baseline 저장
    tryReplay();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // 자리비움 직전 baseline 갱신 — 다음 복귀 때 정확히 측정.
        saveTick({ regionId, ts: Date.now() });
      } else if (document.visibilityState === "visible") {
        tryReplay();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, regionId]);
}
