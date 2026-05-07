import { useEffect, useRef, useState } from "react";
import { BATTLE_SETTINGS_KEY } from "@/lib/storage-keys";

export function useAutoBattle(currentRegionId: string) {
  const [autoBattle, setAutoBattle] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const regionInitRanRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BATTLE_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { auto?: boolean };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAutoBattle(!!parsed.auto);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        BATTLE_SETTINGS_KEY,
        JSON.stringify({ auto: autoBattle }),
      );
    } catch {}
  }, [hydrated, autoBattle]);

  // 지역 이동 시 자동 전투 강제 OFF (첫 mount 시엔 스킵).
  useEffect(() => {
    if (!regionInitRanRef.current) {
      regionInitRanRef.current = true;
      return;
    }
    setAutoBattle(false);
  }, [currentRegionId]);

  return { autoBattle, setAutoBattle };
}
