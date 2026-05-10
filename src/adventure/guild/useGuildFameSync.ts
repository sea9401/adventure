"use client";
import { useEffect, useRef } from "react";
import { reportFameContribution } from "./api";

// 캐릭터 명성이 늘어난 만큼 같은 양을 길드 명성에 동반 적립.
// fame 값을 watch — 증가분만 서버에 보고. 감소(=리셋, 캐릭터 교체 등)는 무시.
// 짧은 시간 내 다발 증가는 debounce 로 묶어 한 번만 전송.
//
// 길드 멤버가 아니면 서버가 silent ignore — 클라이언트는 결과를 신경 쓰지 않는다.
const DEBOUNCE_MS = 1500;

export function useGuildFameSync(currentFame: number): void {
  const lastReportedRef = useRef<number | null>(null);
  const pendingDeltaRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 첫 mount — baseline 만 잡고 보고는 하지 않는다 (저장값 그대로 들어온 상황).
    if (lastReportedRef.current === null) {
      lastReportedRef.current = currentFame;
      return;
    }
    const delta = currentFame - lastReportedRef.current;
    if (delta <= 0) {
      // 명성이 줄거나 그대로면 baseline 만 따라간다.
      lastReportedRef.current = currentFame;
      return;
    }
    pendingDeltaRef.current += delta;
    lastReportedRef.current = currentFame;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const toSend = pendingDeltaRef.current;
      pendingDeltaRef.current = 0;
      timerRef.current = null;
      if (toSend <= 0) return;
      void reportFameContribution(toSend).catch(() => {
        // 네트워크 실패는 silent — 다음 증분에서 다시 시도되지는 않지만
        // 길드 명성은 부수효과라 사용자 경험에 직접 영향 없음.
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentFame]);
}
