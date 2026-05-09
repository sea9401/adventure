"use client";

import type { BattleOutcome } from "./engine";
import { Card } from "@/components/ui/Card";

// 패배 시 BattleScene 위에 띄우는 모달. 사용자 확인을 받아야 시작 마을 이동/HP 0 처리가 진행된다.
// (HP는 풀회복하지 않고 0으로 두어 치유소 사용을 유도.)
// (승리는 cooldown 동안 BattleScene이 그대로 보이므로 결과 카드를 띄우지 않는다.)
export function BattleResult({
  outcome,
  exp,
  onConfirm,
}: {
  outcome: BattleOutcome;
  exp: number;
  onConfirm: () => void;
}) {
  const isWin = outcome === "win";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <Card padding="lg" className="w-full max-w-sm text-center">
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
            복귀 마을로 옮겨졌다. 치유소에서 회복이 필요하다.
          </p>
        )}
        <button
          type="button"
          onClick={onConfirm}
          className="mt-4 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          확인
        </button>
      </Card>
    </div>
  );
}
