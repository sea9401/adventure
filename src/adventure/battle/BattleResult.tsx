"use client";

import type { BattleOutcome } from "./engine";

export function BattleResult({
  outcome,
  exp,
  onConfirm,
  autoConfirm,
}: {
  outcome: BattleOutcome;
  exp: number;
  onConfirm: () => void;
  autoConfirm: boolean;
}) {
  const isWin = outcome === "win";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white/90 p-6 text-center dark:border-zinc-800 dark:bg-zinc-950/90">
      <div
        className={`text-2xl font-semibold ${
          isWin
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {isWin ? "승리!" : "패배..."}
      </div>
      {isWin ? (
        <div className="mt-2 flex items-center justify-center gap-4 text-sm text-zinc-700 dark:text-zinc-300">
          <span className="tabular-nums">EXP +{exp}</span>
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          시작 마을로 옮겨졌다. 자동 전투가 해제되었다.
        </p>
      )}
      <button
        type="button"
        onClick={onConfirm}
        className="mt-4 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {autoConfirm ? "자동 진행 중..." : "확인"}
      </button>
    </div>
  );
}
