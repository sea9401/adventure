"use client";

import type { Town } from "./data/towns";

interface TownCardProps {
  town: Town;
  isCurrent: boolean;
  isUnlocked: boolean;
  unlockLabel: string;
  disabled: boolean;
  onClick: () => void;
}

export function TownCard({
  town,
  isCurrent,
  isUnlocked,
  unlockLabel,
  disabled,
  onClick,
}: TownCardProps) {
  const base = "rounded-lg border px-3 py-2.5 text-left w-full transition-colors";
  const stateClass = isCurrent
    ? "border-fg-strong bg-panel-2"
    : isUnlocked
      ? "border-line bg-panel hover:bg-panel-2 hover:border-line-2"
      : "border-line bg-panel/40 opacity-60";
  const cursorClass = disabled ? "cursor-default" : "cursor-pointer";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${stateClass} ${cursorClass}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-fg-strong">{town.name}</span>
        {isCurrent && <span className="text-[10px] text-emerald-400">현재 위치</span>}
        {!isUnlocked && <span className="text-xs ml-auto">🔒</span>}
      </div>
      <p className="text-xs text-fg-faint mt-1 line-clamp-2">{town.flavor}</p>
      {!isUnlocked && unlockLabel && (
        <p className="text-[11px] text-amber-400 mt-1">{unlockLabel}</p>
      )}
    </button>
  );
}
