import { Sword } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { formatDuration } from "@/lib/format";

// 훈련장 — 12시간 훈련으로 단련 포인트 1개 적립. 적립한 포인트는 성장의 신전에서 사용.
// 완료 횟수는 칭호 마일스톤 트리거에 쓰이며 카드에 노출.
export function TrainingView({
  remaining,
  isTraining,
  unspentPoints,
  completedCount,
  onStartTraining,
  onStartSparring,
}: {
  remaining: number;
  isTraining: boolean;
  unspentPoints: number;
  completedCount: number;
  onStartTraining: () => void;
  onStartSparring: () => void;
}) {
  return (
    <div className="space-y-3">
      <Card as="section" padding="lg">
        <div className="space-y-4">
          <button
            type="button"
            onClick={onStartTraining}
            disabled={isTraining}
            className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-4 py-3 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {isTraining
              ? `훈련 중 · ${formatDuration(remaining)}`
              : "12시간 훈련 시작"}
          </button>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            훈련을 마치면 단련 포인트 1개를 얻는다. 보유 단련 포인트{" "}
            <strong className="tabular-nums text-emerald-700 dark:text-emerald-400">
              {unspentPoints}
            </strong>
            개. 능력치로 새겨넣으려면{" "}
            <strong>성장의 신전</strong>에서 사용한다.
          </p>
          <div className="flex items-center justify-between border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span>누적 훈련 횟수</span>
            <span className="tabular-nums text-zinc-700 dark:text-zinc-200">
              {completedCount}회
            </span>
          </div>
        </div>
      </Card>

      <Card as="section" padding="md">
        <button
          type="button"
          onClick={onStartSparring}
          className="flex w-full items-center justify-between gap-3 rounded-md text-left transition-colors"
        >
          <span className="flex items-center gap-3">
            <Sword size={28} weight="duotone" className="text-zinc-500" />
            <span className="flex flex-col">
              <span className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                허수아비치기
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                공격력도 방어력도 없는 허수아비다.
              </span>
            </span>
          </span>
        </button>
      </Card>
    </div>
  );
}
