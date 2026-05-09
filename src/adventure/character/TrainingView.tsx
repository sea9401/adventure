import { Card } from "@/components/ui/Card";
import { formatDuration } from "@/lib/format";

// 훈련장 — 6시간 훈련으로 단련 포인트 1개 적립. 적립한 포인트는 성장의 신전에서 사용.
export function TrainingView({
  remaining,
  isTraining,
  unspentPoints,
  onStartTraining,
}: {
  remaining: number;
  isTraining: boolean;
  unspentPoints: number;
  onStartTraining: () => void;
}) {
  return (
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
            : "6시간 훈련 시작"}
        </button>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          훈련을 마치면 단련 포인트 1개를 얻는다. 보유 단련 포인트{" "}
          <strong className="tabular-nums text-emerald-700 dark:text-emerald-400">
            {unspentPoints}
          </strong>
          개. 능력치로 새겨넣으려면{" "}
          <strong>성장의 신전</strong>에서 사용한다.
        </p>
      </div>
    </Card>
  );
}
