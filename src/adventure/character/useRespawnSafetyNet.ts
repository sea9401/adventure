"use client";

import { useEffect } from "react";
import { START_REGION_ID } from "@/adventure/data/world";
import type { MapProgress } from "@/lib/map-progress";

// 안전망 — HP<=0 인데 마을이 아닌 곳에 있으면 복귀 마을로 강제 이동.
// 패배 모달을 확인하기 전에 새로고침/탭 닫기로 빠져나가 stuck 된 유저를 다음 진입에서 구출.
//
// HP 를 1 로 끌어올려 region 패치 실패 시 다음 mount 에서 같은 곳/HP=0 로 돌아와도
// hp>0 가드로 안전망 재발동을 차단 (무한 텔레포트 루프 방지).
// huntingActive 도 함께 정리 — 지역 변경 effect 가 "지역 이동으로 자동 사냥 정지" 유령
// 토스트를 띄우지 않게.
export function useRespawnSafetyNet(opts: {
  hp: number;
  isTown: boolean;
  mapProgress: MapProgress;
  setMapProgress: (updater: (prev: MapProgress) => MapProgress) => void;
  setHp: (hp: number) => void;
  setHuntingActive: (active: boolean) => void;
  replaceSubView: (sub: string | null) => void;
}) {
  const { hp, isTown, mapProgress, setMapProgress, setHp, setHuntingActive, replaceSubView } = opts;
  useEffect(() => {
    if (hp > 0) return;
    if (isTown) return;
    const respawnId = mapProgress.respawnRegionId ?? START_REGION_ID;
    setMapProgress((prev) => ({
      ...prev,
      currentRegionId: respawnId,
      visitedRegionIds: prev.visitedRegionIds.includes(respawnId)
        ? prev.visitedRegionIds
        : [...prev.visitedRegionIds, respawnId],
    }));
    setHp(1);
    setHuntingActive(false);
    replaceSubView(null);
    // setter 들은 안정 참조 — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hp, isTown]);
}
