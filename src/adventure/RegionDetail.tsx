import type { Region } from "./data/world";
import type { NodeState } from "./MapNode";

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
  onMove,
}: {
  region: Region | null;
  state: NodeState | null;
  canMove: boolean;
  onMove: () => void;
}) {
  if (!region || !state) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white/40 px-4 py-3 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
        지도에서 지역을 선택하세요.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
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
      <button
        type="button"
        disabled={!canMove}
        onClick={onMove}
        className="mt-3 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {state === "current" ? "이미 이곳에 있음" : canMove ? "이동" : "지금은 갈 수 없음"}
      </button>
    </div>
  );
}
