"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

type Variant = "achievement" | "milestone" | "drop" | "info";

const VARIANT_CLS: Record<Variant, string> = {
  achievement: "bg-amber-900/95 border border-amber-600",
  milestone: "bg-gradient-to-br from-emerald-900/95 to-amber-900/95 border-2 border-amber-500",
  drop: "bg-gradient-to-br from-orange-900/95 to-rose-900/95 border-2 border-orange-400",
  info: "bg-panel border border-line-2",
};

export function ToastShell({
  variant = "info",
  icon,
  iconClassName,
  onDismiss,
  autoDismissMs = 5000,
  resetKey,
  zIndex = 110,
  maxWidth = "max-w-md",
  children,
}: {
  variant?: Variant;
  icon?: ReactNode;
  iconClassName?: string;
  onDismiss: () => void;
  autoDismissMs?: number;
  resetKey?: string | number;
  zIndex?: number;
  maxWidth?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, autoDismissMs]);

  return (
    <div
      className={`fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 rounded-lg shadow-2xl px-4 py-3 ${maxWidth} ${VARIANT_CLS[variant]}`}
      style={{ zIndex }}
    >
      <div className="flex items-start gap-3">
        {icon && <span className={iconClassName ?? "text-2xl"}>{icon}</span>}
        <div className="min-w-0 flex-1">{children}</div>
        <button onClick={onDismiss} className="text-fg-muted hover:text-fg text-sm">
          ✕
        </button>
      </div>
    </div>
  );
}
