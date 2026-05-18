import { useCallback, useState } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import {
  addParagonExp as addParagonExpPure,
  initialParagonState,
  readInitialParagon,
  type ParagonState,
} from "@/lib/paragon";

/**
 * 파라곤 상태 영속화 hook — 100레벨 도달 후 캡된 EXP 를 적립.
 * PR-A 범위: 적립/로드/저장만. 포인트 할당과 효과 적용은 PR-B/C 에서.
 *
 * page.tsx 가 useCharacterState 의 `onParagonOverflow` 와 짝지어 주입:
 *   const paragon = useParagonState();
 *   const characterStateHook = useCharacterState({
 *     onParagonOverflow: paragon.addParagonExp,
 *   });
 */
export function useParagonState() {
  const initial = useSavedValue("paragon.v1");
  const [state, setState] = useState<ParagonState>(() =>
    readInitialParagon(initial),
  );
  useRemotePatch("paragon.v1", state);

  const addParagonExp = useCallback((gain: number) => {
    if (!Number.isFinite(gain) || gain <= 0) return;
    setState((prev) => addParagonExpPure(prev, gain));
  }, []);

  const reset = useCallback(() => {
    setState(initialParagonState);
  }, []);

  return {
    state,
    addParagonExp,
    reset,
  };
}
