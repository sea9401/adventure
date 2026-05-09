"use client";

import { useEffect, useState } from "react";
import { Sparkle } from "@phosphor-icons/react";

const SHOW_DURATION_MS = 2200;

// 레벨업 한 번 발화 시 짧게 떠오르는 축하 오버레이.
// page.tsx 의 레벨업 effect 가 useState 로 trigger key 를 올려주면 재발화.
export function LevelUpOverlay({
  level,
  triggerKey,
}: {
  level: number;
  /** 변화 감지용 — 같은 trigger 로는 두 번 안 뜸. */
  triggerKey: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (triggerKey === 0) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), SHOW_DURATION_MS);
    return () => clearTimeout(id);
  }, [triggerKey]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
    >
      <div className="animate-in zoom-in-50 fade-in duration-300 fill-mode-forwards">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-200 px-8 py-6 shadow-2xl dark:border-amber-500/50 dark:from-amber-900/80 dark:via-yellow-950/60 dark:to-amber-800/80">
          <Sparkle
            size={40}
            weight="fill"
            className="text-amber-500 drop-shadow"
          />
          <div className="text-xs font-medium uppercase tracking-widest text-amber-700 dark:text-amber-300">
            Level Up
          </div>
          <div className="text-3xl font-bold text-amber-900 tabular-nums dark:text-amber-100">
            Lv. {level}
          </div>
        </div>
      </div>
    </div>
  );
}
