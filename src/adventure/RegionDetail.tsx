import type { Region } from "./data/world";
import type { EdgeRequirementStatus } from "./data/edge-requirement";
import type { NodeState } from "./MapNode";
import { Card } from "@/components/ui/Card";

const STATE_LABELS: Record<NodeState, string> = {
  current: "현재 위치",
  visited: "방문함",
  reachable: "이동 가능",
  locked: "이동 불가",
};

export function RegionDetail({
  region,
  state,
  canMove,
  canChallenge,
  onMove,
  requirementStatus,
  scrollMove,
}: {
  region: Region | null;
  state: NodeState | null;
  canMove: boolean;
  canChallenge?: boolean;
  onMove: () => void;
  requirementStatus?: EdgeRequirementStatus | null;
  /** 마을 귀환 주문서로 이동 가능한 경우 — 보유 수량 노출. count<=0 이면 비활성. */
  scrollMove?: { count: number };
}) {
  if (!region || !state) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white/90 px-4 py-3 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/90 dark:text-zinc-400">
        지도에서 지역을 선택하세요.
      </div>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {region.name}
        </h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {STATE_LABELS[state]}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {region.description}
      </p>
      {requirementStatus?.progress && !requirementStatus.met && (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {requirementStatus.kind === "trial"
            ? requirementStatus.reason ?? requirementStatus.progress.label
            : `진행 조건: ${requirementStatus.progress.label} 완성 (${requirementStatus.progress.current} / ${requirementStatus.progress.total})`}
        </div>
      )}
      <button
        type="button"
        disabled={
          !canMove &&
          !canChallenge &&
          !(scrollMove && scrollMove.count > 0)
        }
        onClick={onMove}
        className="mt-3 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-[transform,background-color] duration-100 hover:bg-zinc-100 active:scale-[0.97] active:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
      >
        {state === "current"
          ? "이미 이곳에 있음"
          : canMove
            ? "이동"
            : canChallenge
              ? "시련 도전"
              : scrollMove
                ? scrollMove.count > 0
                  ? `주문서로 이동 (×${scrollMove.count})`
                  : "귀환 주문서가 없다"
                : "지금은 갈 수 없음"}
      </button>
    </Card>
  );
}
