"use client";

import { useEffect, useState } from "react";
import { useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import type { TabKey } from "@/lib/useNavTabs";
import type { TrialEdge } from "@/adventure/TrialView";

type PersistedTrial = { edge: TrialEdge; winCount: number };

// 시련(trial) 진행 — 엣지 + 누적 승수. trial.v1 로 영구 저장.
// reload / 백그라운드 복귀 후 location.reload 가 일어나도 진행도 보존.
// 사용자가 모험/지도 외 화면으로 나가면 자동 취소 (의도적 abort).
export function useTrialState({
  tab,
  subView,
}: {
  tab: TabKey;
  subView: string | null;
}) {
  const initial = useSavedValue<PersistedTrial | null>("trial.v1");
  const [trial, setTrial] = useState<PersistedTrial | null>(() => {
    if (!initial || typeof initial !== "object") return null;
    if (!initial.edge || typeof initial.winCount !== "number") return null;
    return initial;
  });
  useRemotePatch("trial.v1", trial);

  const start = (edge: TrialEdge) => setTrial({ edge, winCount: 0 });
  const end = () => {
    setTrial(null);
    // 다음 시련의 재개 안내가 정상 동작하도록 dedup 키 클리어.
    try {
      sessionStorage.removeItem("trial-resume-shown.v1");
    } catch {}
  };
  const recordWin = (winCount: number) =>
    setTrial((prev) => (prev ? { ...prev, winCount } : prev));

  // 사용자가 모험/지도 밖으로 이동하면 자동 취소.
  // reload/visibilitychange 로 인한 location.reload 후엔 URL 이 보존돼 같은 위치에서
  // 복귀하므로 trial 도 그대로 살아남는다.
  useEffect(() => {
    if (!trial) return;
    if (tab !== "adventure" || subView !== "map") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      end();
    }
  }, [tab, subView, trial]);

  return {
    trial,
    edge: trial?.edge ?? null,
    winCount: trial?.winCount ?? 0,
    start,
    end,
    recordWin,
  };
}
