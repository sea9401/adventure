import { useEffect, useRef } from "react";
import { useRemoteSave } from "./SaveProvider";
import type { SyncedKey } from "./synced-keys";

// SaveProvider 가 초기값을 이미 주입하므로 첫 마운트의 patch 는 서버 데이터를
// 자기 자신에게 다시 보내는 의미 없는 호출 — 그래서 skip.
// 이후 value 변화만 서버로 보낸다 (디바운스는 remoteSave 내부에서 처리).
export function useRemotePatch<T>(key: SyncedKey, value: T) {
  const remote = useRemoteSave();
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    remote.patch(key, value);
  }, [remote, key, value]);
}
