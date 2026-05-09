"use client";

import { useEffect } from "react";

// /sw.js 등록은 production 에서만. dev 는 Turbopack HMR 과 fetch 가로채기가
// 충돌하기 쉽고, 정적 이미지가 자주 재생성되는 이 프로젝트 특성상 stale 캐시 위험.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => {
        console.warn("Service worker register failed:", err);
      });
  }, []);

  return null;
}
