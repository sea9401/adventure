import type { Biome, Region } from "./data/world";

const NODE_RADIUS = 24;

export type NodeState = "current" | "visited" | "reachable" | "locked";

const BIOME_FILL: Record<Biome, string> = {
  village: "fill-amber-200 dark:fill-amber-900/60",
  plains: "fill-lime-200 dark:fill-lime-900/60",
  forest: "fill-emerald-200 dark:fill-emerald-900/60",
  cave: "fill-stone-300 dark:fill-stone-800",
  lake: "fill-sky-200 dark:fill-sky-900/60",
  ruins: "fill-rose-200 dark:fill-rose-900/60",
};

const BIOME_STROKE: Record<Biome, string> = {
  village: "stroke-amber-500 dark:stroke-amber-700",
  plains: "stroke-lime-500 dark:stroke-lime-700",
  forest: "stroke-emerald-500 dark:stroke-emerald-700",
  cave: "stroke-stone-500 dark:stroke-stone-600",
  lake: "stroke-sky-500 dark:stroke-sky-700",
  ruins: "stroke-rose-500 dark:stroke-rose-700",
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
  const isCurrent = state === "current";
  const isReachable = state === "reachable";
  const isLocked = state === "locked";

  const fillClass = isLocked
    ? "fill-zinc-100 dark:fill-zinc-900"
    : BIOME_FILL[region.biome];

  const strokeClass = selected
    ? "stroke-zinc-900 dark:stroke-zinc-100"
    : isCurrent
      ? "stroke-emerald-600 dark:stroke-emerald-400"
      : isLocked
        ? "stroke-zinc-300 dark:stroke-zinc-700"
        : BIOME_STROKE[region.biome];

  const labelClass = isLocked
    ? "fill-zinc-400 dark:fill-zinc-600"
    : isCurrent
      ? "fill-zinc-900 dark:fill-zinc-100 font-semibold"
      : "fill-zinc-700 dark:fill-zinc-200";

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
      opacity={isLocked ? 0.55 : 1}
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
          className="fill-emerald-500/30"
        >
          <animate
            attributeName="r"
            values={`${NODE_RADIUS + 4};${NODE_RADIUS + 12};${NODE_RADIUS + 4}`}
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.7;0.15;0.7"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {isReachable && (
        <circle
          cx={region.position.x}
          cy={region.position.y}
          r={NODE_RADIUS + 4}
          className="fill-amber-400/30"
        >
          <animate
            attributeName="r"
            values={`${NODE_RADIUS + 2};${NODE_RADIUS + 9};${NODE_RADIUS + 2}`}
            dur="2.6s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.55;0.1;0.55"
            dur="2.6s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <circle
        cx={region.position.x}
        cy={region.position.y}
        r={NODE_RADIUS}
        strokeWidth={selected ? 3 : 2}
        className={`${fillClass} ${strokeClass}`}
      />
      {isLocked && (
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
        className={`${labelClass} text-[13px] select-none`}
      >
        {region.name}
      </text>
    </g>
  );
}
