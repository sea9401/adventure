"use client";

import type { ReactNode } from "react";

type Size = "sm" | "md" | "lg";
// 데스크톱(sm+) 한정 — 모바일에선 풀스크린이라 max-w 무시.
const SIZE_CLS: Record<Size, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

export function ModalShell({
  title,
  onClose,
  size = "md",
  children,
  zIndex = 100,
  closeOnBackdrop = true,
  showCloseButton = true,
}: {
  title?: ReactNode;
  onClose: () => void;
  size?: Size;
  children: ReactNode;
  zIndex?: number;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center sm:p-4 overflow-y-auto"
      style={{ zIndex }}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`bg-panel-2 border border-line-2 sm:rounded-lg shadow-2xl flex flex-col w-full ${SIZE_CLS[size]} max-h-[100dvh] sm:max-h-[90vh] min-h-[100dvh] sm:min-h-0`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-line-2 bg-panel-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="font-medium text-fg-strong">{title}</span>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-fg-muted hover:text-fg-strong px-2 py-1 rounded text-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="닫기"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto pb-[max(0,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
