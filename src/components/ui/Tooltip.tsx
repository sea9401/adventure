"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// 한 번에 하나의 툴팁만 표시되도록 모듈 단위 구독자 집합
const tooltipSubs = new Set<(activeId: string) => void>();

// SSR 안전 layout effect — 클라이언트에서만 useLayoutEffect, 서버에선 no-op.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const VIEWPORT_PADDING = 8; // 화면 가장자리 최소 여백

export function Tooltip({
  content,
  children,
  multiline = false,
  className = "",
}: {
  content: ReactNode;
  children: ReactNode;
  multiline?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom";
  } | null>(null);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handler = (activeId: string) => {
      if (activeId !== id) {
        setOpen(false);
        setPinned(false);
      }
    };
    tooltipSubs.add(handler);
    return () => {
      tooltipSubs.delete(handler);
    };
  }, [id]);

  useEffect(() => {
    if (!pinned) return;
    const onOutside = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    const t = setTimeout(() => document.addEventListener("click", onOutside), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", onOutside);
    };
  }, [pinned]);

  // 툴팁이 열릴 때마다 — 그리고 resize/scroll 시 — 화면 안에 들어오도록 위치 재계산.
  useIsoLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const compute = () => {
      const wrap = wrapRef.current;
      const tip = tooltipRef.current;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      // tooltip이 아직 렌더 안 됐으면 wrapper 너비로 임시 계산 (다음 frame에 재조정).
      const tw = tip?.offsetWidth ?? wr.width;
      const th = tip?.offsetHeight ?? 0;

      const wrapCenterX = wr.left + wr.width / 2;
      let left = wrapCenterX - tw / 2;
      // 화면 좌우 여백 클램프
      const maxLeft = window.innerWidth - tw - VIEWPORT_PADDING;
      const minLeft = VIEWPORT_PADDING;
      if (left < minLeft) left = minLeft;
      else if (left > maxLeft) left = Math.max(minLeft, maxLeft);

      // 위 공간이 부족하면 아래로 표시
      const spaceAbove = wr.top;
      const placement: "top" | "bottom" = th > 0 && spaceAbove < th + 8 ? "bottom" : "top";
      const top =
        placement === "top" ? wr.top + window.scrollY - th - 4 : wr.bottom + window.scrollY + 4;

      setPos({ top, left: left + window.scrollX, placement });
    };
    compute();
    // 두 번째 프레임에 tooltip 실제 크기 기준으로 재조정 (offsetWidth가 0이었을 가능성 대비).
    const raf = window.requestAnimationFrame(compute);
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, { passive: true });
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute);
    };
  }, [open, content]);

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex cursor-help ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        const next = !pinned;
        setPinned(next);
        setOpen(next);
        if (next) tooltipSubs.forEach((fn) => fn(id));
      }}
    >
      {children}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            ref={tooltipRef}
            style={
              pos
                ? { position: "absolute", top: pos.top, left: pos.left, zIndex: 60 }
                : { position: "absolute", top: -9999, left: -9999, zIndex: 60 }
            }
            className={`rounded bg-panel-2 border border-line-2 px-2 py-1 text-xs text-fg shadow-lg pointer-events-none ${
              multiline
                ? "whitespace-normal max-w-[min(20rem,calc(100vw-16px))]"
                : "whitespace-nowrap max-w-[calc(100vw-16px)]"
            }`}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}
