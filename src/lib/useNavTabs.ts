"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// 메인 탭/서브뷰 상태를 URL 쿼리(?tab=...&sub=...) 로 동기화 → 브라우저 back/forward 가
// 자연스럽게 in-app 네비게이션처럼 동작.
//
// - setTab/setSubView: history 에 entry 추가 (push). 사용자가 직접 일으킨 이동.
// - replaceSubView: history entry 추가 없이 교체 (replace). 사망·강제 복귀 같은 system cleanup.
// - back: router.back() 으로 직전 entry 로. in-app back 버튼용.

const TAB_KEYS = ["adventure", "town", "character", "plaza"] as const;
export type TabKey = (typeof TAB_KEYS)[number];
const DEFAULT_TAB: TabKey = "adventure";

function isTabKey(v: string | null): v is TabKey {
  return v !== null && (TAB_KEYS as readonly string[]).includes(v);
}

// pathname 기준 절대 경로로 href 구성. relative "?" 만 푸시하면 Next.js 16 router 가
// 같은 path 로 보고 navigation 을 생략해 useSearchParams 가 갱신 안 되는 경우가 있음
// (예: refresh 후 ?tab=town 에서 모험 탭 클릭 시 첫 클릭이 무시되는 증상). 항상 명시.
function buildHref(pathname: string, tab: TabKey, sub: string | null): string {
  const params = new URLSearchParams();
  if (tab !== DEFAULT_TAB) params.set("tab", tab);
  if (sub) params.set("sub", sub);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function useNavTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const tab: TabKey = isTabKey(rawTab) ? rawTab : DEFAULT_TAB;
  const subView = searchParams.get("sub");

  const setTab = useCallback(
    (next: TabKey) => {
      router.push(buildHref(pathname, next, null));
    },
    [router, pathname],
  );

  const setSubView = useCallback(
    (next: string | null) => {
      router.push(buildHref(pathname, tab, next));
    },
    [router, pathname, tab],
  );

  const replaceSubView = useCallback(
    (next: string | null) => {
      router.replace(buildHref(pathname, tab, next));
    },
    [router, pathname, tab],
  );

  // tab + sub 를 한 번에 교체 — 사망 시 패배 모달 confirm → 치료소 강제 이동처럼
  // 시스템이 일으키는 점프 용도 (replace 라 history 에 남지 않음).
  const replaceLocation = useCallback(
    (nextTab: TabKey, nextSub: string | null) => {
      router.replace(buildHref(pathname, nextTab, nextSub));
    },
    [router, pathname],
  );

  const back = useCallback(() => {
    router.back();
  }, [router]);

  return {
    tab,
    subView,
    setTab,
    setSubView,
    replaceSubView,
    replaceLocation,
    back,
  };
}
