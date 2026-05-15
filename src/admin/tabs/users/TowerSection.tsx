"use client";

import { Button } from "../../ui/Field";
import { TOWER_DAILY_ATTEMPTS, type TowerState } from "@/adventure/tower/types";

// 고탑 일일 입장 횟수 — tower.v1 의 daily 필드. null 로 비우면 서버가 다음 start 때
// 오늘 날짜로 재초기화한다. progress / run 은 건드리지 않는다.
export function TowerSection({
  tower,
  readOnly,
  loading,
  onResetDailyAttempts,
}: {
  tower: TowerState | undefined;
  readOnly: boolean;
  loading: boolean;
  onResetDailyAttempts: () => void;
}) {
  const used = tower?.daily?.attempts ?? 0;
  const date = tower?.daily?.date ?? null;
  const hasUsage = used > 0;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">고탑</h2>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        오늘 입장 {used} / {TOWER_DAILY_ATTEMPTS}
        {date ? ` (${date})` : ""}
      </p>
      <div className="mt-3">
        <Button
          disabled={readOnly || loading || !hasUsage}
          onClick={onResetDailyAttempts}
        >
          일일 입장 횟수 초기화
        </Button>
      </div>
      {readOnly && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          보기 전용 모드 — 상단에서 편집 가능으로 전환해야 동작합니다.
        </p>
      )}
    </section>
  );
}
