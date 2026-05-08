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
  // 자리비운 시간(ms)을 받아 시뮬을 돌리고 결과를 반환. 호출 측에서 입력값을
  // 클로저에 가둬두기 좋다 (현재 player/potions/rules를 매번 새로 읽도록).
  runSim: (awayMs: number) => OfflineSimResult;
  // 시뮬 결과를 캐릭터/인벤토리/알림에 반영.
  onApply: (result: OfflineSimResult) => void;
};

// 트리거: visibility hidden→visible 한 사이클을 완전히 거친 경우에만.
//   - mount/active toggle 시점엔 baseline만 갱신 — 새로고침이나 단순 재진입으로는 시뮬 안 됨.
//   - 사용자가 명시적으로 active=true로 두고 페이지/탭을 떠난 다음 돌아왔을 때만 보상 적용.
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

    // mount/active 변화 시점엔 baseline만 갱신. 시뮬 트리거는 visibility 사이클로 한정.
    saveTick({ regionId, ts: Date.now(), active });

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        saveTick({ regionId, ts: Date.now(), active });
      } else if (document.visibilityState === "visible") {
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
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, regionId, active]);
}
