"use client";

import { useState } from "react";
import {
  WORLD_MAP,
  getAdjacent,
  type RegionId,
} from "./data/world";
import type { MapProgress } from "@/lib/map-progress";
import { MapEdge } from "./MapEdge";
import { MapNode, type NodeState } from "./MapNode";
import { RegionDetail } from "./RegionDetail";

export function MapView({
  progress,
  onProgressChange,
}: {
  progress: MapProgress;
  onProgressChange: (next: MapProgress) => void;
}) {
  const [selectedId, setSelectedId] = useState<RegionId | null>(null);

  const visitedSet = new Set(progress.visitedRegionIds);
  const adjacentToCurrent = new Set(
    getAdjacent(WORLD_MAP, progress.currentRegionId),
  );

  const stateOf = (id: RegionId): NodeState => {
    if (id === progress.currentRegionId) return "current";
    if (visitedSet.has(id)) return "visited";
    for (const v of progress.visitedRegionIds) {
      if (getAdjacent(WORLD_MAP, v).includes(id)) return "reachable";
    }
    return "locked";
  };

  const isEdgeActive = (fromId: RegionId, toId: RegionId): boolean =>
    visitedSet.has(fromId) && visitedSet.has(toId);

  const selectedRegion = selectedId
    ? (WORLD_MAP.regions.find((r) => r.id === selectedId) ?? null)
    : null;
  const selectedState = selectedId ? stateOf(selectedId) : null;
  const canMove =
    !!selectedId &&
    selectedId !== progress.currentRegionId &&
    adjacentToCurrent.has(selectedId);

  const handleMove = () => {
    if (!selectedId || !canMove) return;
    onProgressChange({
      currentRegionId: selectedId,
      visitedRegionIds: progress.visitedRegionIds.includes(selectedId)
        ? progress.visitedRegionIds
        : [...progress.visitedRegionIds, selectedId],
    });
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90">
        <svg
          viewBox={`0 0 ${WORLD_MAP.viewBox.width} ${WORLD_MAP.viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="block h-auto w-full"
          role="img"
          aria-label="월드맵"
        >
          {WORLD_MAP.edges.map((edge) => {
            const from = WORLD_MAP.regions.find((r) => r.id === edge.from);
            const to = WORLD_MAP.regions.find((r) => r.id === edge.to);
            if (!from || !to) return null;
            return (
              <MapEdge
                key={`${edge.from}-${edge.to}`}
                from={from}
                to={to}
                active={isEdgeActive(edge.from, edge.to)}
              />
            );
          })}
          {WORLD_MAP.regions.map((region) => (
            <MapNode
              key={region.id}
              region={region}
              state={stateOf(region.id)}
              selected={selectedId === region.id}
              onClick={() => setSelectedId(region.id)}
            />
          ))}
        </svg>
      </div>
      <RegionDetail
        region={selectedRegion}
        state={selectedState}
        canMove={canMove}
        onMove={handleMove}
      />
    </div>
  );
}
