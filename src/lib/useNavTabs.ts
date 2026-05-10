"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// 메인 탭/서브뷰 상태를 URL 쿼리(?tab=...&sub=...) 로 동기화 → 브라우저 back/forward 가
// 자연스럽게 in-app 네비게이션처럼 동작.
//
// - setTab/setSubView: history 에 entry 추가 (push). 사용자가 직접 일으킨 이동.
// - replaceSubView: history entry 추가 없이 교체 (replace). 사망·강제 복귀 같은 system cleanup.
// - back: 현재 탭의 entry 화면(sub=null)으로 replace. SubViewHeader 의 뒤로 버튼용.
//   router.back() 은 직접 URL 입장 / replaceLocation 이후 / 다른 탭에서 들어온 경우
//   SPA 밖으로 나가거나 엉뚱한 위치로 가는 사고가 있어 history 가 아닌 명시적
//   "상위로 이동" 으로 정의.

const TAB_KEYS = ["adventure", "town", "character", "plaza"] as const;
export type TabKey = (typeof TAB_KEYS)[number];
const DEFAULT_TAB: TabKey = "adventure";

function isTabKey(v: string | null): v is TabKey {
  return v !== null && (TAB_KEYS as readonly string[]).includes(v);
}

// pathname 기준 절대 경로 + tab 은 항상 명시. relative "?" 만 푸시하거나 default 탭으로
// 가면서 query 를 비우면 (= pathname 만 push) Next.js 16 router 가 같은 path 로 보고
// navigation 을 dedupe 하는 경우가 있다. 증상: ?tab=town 등에서 새로고침/탭 복귀 후
// 모험 탭 첫 클릭이 무시 → 다른 버튼으로 re-render 트리거되면 그제서야 풀림.
// tab 을 항상 query 에 박으면 어느 탭으로 가도 URL 이 명확히 달라져 dedupe 여지가 사라진다.
function buildHref(pathname: string, tab: TabKey, sub: string | null): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (sub) params.set("sub", sub);
  return `${pathname}?${params.toString()}`;
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
    router.replace(buildHref(pathname, tab, null));
  }, [router, pathname, tab]);

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
