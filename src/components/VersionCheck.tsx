"use client";

import { useCallback, useEffect, useState } from "react";

// 새 배포 감지 → "새 버전 — 새로고침" 토스트.
//
// 로드한 빌드(NEXT_PUBLIC_BUILD_ID, 빌드 시점에 인라인)와 /api/version 의 현재 배포 buildId 를
// 비교 — 다르면 그 사이 새 배포가 떴다는 뜻. 마운트 직후 + 탭이 다시 보일 때(visibilitychange/
// focus) + 주기적으로(5분) 검사. 로컬/CLI 빌드(둘 다 "dev")는 비교 무의미 → 건너뜀.
//
// 새로고침은 사용자가 누를 때만 — 전투/입력 중 갑자기 reload 하면 곤란하므로 자동 reload 안 함.
// (캐릭터 진행은 서버 자동저장이라 reload 자체는 안전하지만, 끊김 방지로 명시적 클릭만.)

const LOADED_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function VersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const check = useCallback(async () => {
    if (LOADED_BUILD_ID === "dev") return;
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { buildId?: string };
      if (
        data.buildId &&
        data.buildId !== "dev" &&
        data.buildId !== LOADED_BUILD_ID
      ) {
        setUpdateAvailable(true);
      }
    } catch {
      // 일시적 실패 — 다음 검사에서 재시도.
    }
  }, []);

  useEffect(() => {
    if (LOADED_BUILD_ID === "dev") return;
    // check() 는 비동기 fetch 후 외부(배포된 버전)에 따라 setState — 동기 cascade 아님.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
    const id = setInterval(() => void check(), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border border-emerald-700/40 bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
      <span>새 버전이 나왔습니다.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full border border-white/40 bg-white/15 px-3 py-0.5 text-xs font-semibold transition-colors hover:bg-white/25"
      >
        새로고침
      </button>
    </div>
  );
}
