"use client";

import { useEffect } from "react";

// 모달 열려있는 동안 body 스크롤 차단. 닫히면 원상복구.
// 동시에 여러 모달이 열려도 카운트 기반이라 마지막 모달 닫힐 때만 풀린다.
let lockCount = 0;
let savedOverflow: string | null = null;
let savedPaddingRight: string | null = null;

export function useScrollLock(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;
    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      savedPaddingRight = document.body.style.paddingRight;
      // 스크롤바 폭만큼 padding 채워 레이아웃 점프 방지.
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbar > 0) {
        document.body.style.paddingRight = `${scrollbar}px`;
      }
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow ?? "";
        document.body.style.paddingRight = savedPaddingRight ?? "";
        savedOverflow = null;
        savedPaddingRight = null;
      }
    };
  }, [enabled]);
}
