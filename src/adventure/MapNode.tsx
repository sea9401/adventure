import type { Region } from "./data/world";

const NODE_RADIUS = 24;

export type NodeState = "current" | "visited" | "reachable" | "locked";

const STYLES: Record<NodeState, { fill: string; stroke: string; label: string }> = {
  current: {
    fill: "fill-emerald-500",
    stroke: "stroke-emerald-600 dark:stroke-emerald-400",
    label: "fill-zinc-900 dark:fill-zinc-100",
  },
  visited: {
    fill: "fill-zinc-100 dark:fill-zinc-800",
    stroke: "stroke-zinc-400 dark:stroke-zinc-500",
    label: "fill-zinc-700 dark:fill-zinc-300",
  },
  reachable: {
    fill: "fill-white dark:fill-zinc-900",
    stroke: "stroke-zinc-400 dark:stroke-zinc-500",
    label: "fill-zinc-700 dark:fill-zinc-300",
  },
  locked: {
    fill: "fill-zinc-50 dark:fill-zinc-900/50",
    stroke: "stroke-zinc-300 dark:stroke-zinc-700",
    label: "fill-zinc-400 dark:fill-zinc-600",
  },
};

export function MapNode({
  region,
  state,
  selected,
  onClick,
}: {
  region: Region;
  state: NodeState;
  selected: boolean;
  onClick: () => void;
}) {
  const s = STYLES[state];
  const isCurrent = state === "current";

  return (
    <g
      onClick={onClick}
      className="cursor-pointer outline-none"
      role="button"
      tabIndex={0}
      aria-label={region.name}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <circle
        cx={region.position.x}
        cy={region.position.y}
        r={36}
        fill="transparent"
      />
      {isCurrent && (
        <circle
          cx={region.position.x}
          cy={region.position.y}
          r={NODE_RADIUS + 6}
          className="fill-emerald-500/25"
        >
          <animate
            attributeName="r"
            values={`${NODE_RADIUS + 4};${NODE_RADIUS + 12};${NODE_RADIUS + 4}`}
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0.15;0.6"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <circle
        cx={region.position.x}
        cy={region.position.y}
        r={NODE_RADIUS}
        strokeWidth={selected ? 3 : 2}
        className={`${s.fill} ${selected ? "stroke-zinc-900 dark:stroke-zinc-100" : s.stroke}`}
      />
      {state === "locked" && (
        <text
          x={region.position.x}
          y={region.position.y + 5}
          textAnchor="middle"
          className="fill-zinc-400 dark:fill-zinc-600 text-[16px] select-none"
        >
          🔒
        </text>
      )}
      <text
        x={region.position.x}
        y={region.position.y + NODE_RADIUS + 18}
        textAnchor="middle"
        className={`${s.label} text-[13px] ${isCurrent ? "font-semibold" : ""} select-none`}
      >
        {region.name}
      </text>
    </g>
  );
}
