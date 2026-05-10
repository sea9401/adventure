"use client";

import { useState } from "react";
import {
  WORLD_MAP,
  getAdjacent,
  type RegionId,
} from "./data/world";
import {
  evaluateEdgeRequirement,
  findEdgeRequirement,
  type EdgeRequirementStatus,
} from "./data/edge-requirement";
import type { MapProgress } from "@/lib/map-progress";
import type { AdventureLog } from "./log/storage";
import { MapEdge } from "./MapEdge";
import { MapNode, type NodeState } from "./MapNode";
import { MapCanvas } from "./MapCanvas";
import { RegionDetail } from "./RegionDetail";
import { Card } from "@/components/ui/Card";
import { useGame } from "./GameContext";

export function MapView({
  progress,
  onProgressChange,
  log,
  playerHp,
  isTrialCleared,
  hasStoryFlag,
  onTrialStart,
}: {
  progress: MapProgress;
  onProgressChange: (next: MapProgress) => void;
  log: AdventureLog;
  playerHp: number;
  isTrialCleared: (regionId: RegionId) => boolean;
  hasStoryFlag: (flagId: string) => boolean;
  onTrialStart: (from: RegionId, to: RegionId) => void;
}) {
  const { addNotification } = useGame();
  const [selectedId, setSelectedId] = useState<RegionId | null>(null);
  const [lowHpBlocked, setLowHpBlocked] = useState(false);

  const visitedSet = new Set(progress.visitedRegionIds);
  const adjacentToCurrent = new Set(
    getAdjacent(WORLD_MAP, progress.currentRegionId),
  );

  const stateOf = (id: RegionId): NodeState => {
    if (id === progress.currentRegionId) return "current";
    if (visitedSet.has(id)) return "visited";
    for (const v of progress.visitedRegionIds) {
      if (!getAdjacent(WORLD_MAP, v).includes(id)) continue;
      // 마을 직통 이동 (kind: "visited") 은 목적지 발견 후에만 활성화 — reachability
      // 계산에서 제외해 미발견 마을이 "도달 가능" 으로 잘못 표시되지 않게 한다.
      const req = findEdgeRequirement(v, id) ?? findEdgeRequirement(id, v);
      if (req?.kind === "visited") continue;
      return "reachable";
    }
    return "locked";
  };

  const isEdgeActive = (fromId: RegionId, toId: RegionId): boolean =>
    visitedSet.has(fromId) && visitedSet.has(toId);

  const selectedRegion = selectedId
    ? (WORLD_MAP.regions.find((r) => r.id === selectedId) ?? null)
    : null;
  const selectedState = selectedId ? stateOf(selectedId) : null;
  const isAdjacent = !!selectedId && adjacentToCurrent.has(selectedId);
  const selectedReq = selectedId
    ? findEdgeRequirement(progress.currentRegionId, selectedId)
    : undefined;
  const requirementStatus: EdgeRequirementStatus | null =
    selectedId && isAdjacent
      ? evaluateEdgeRequirement(selectedReq, {
          log,
          isTrialCleared,
          hasStoryFlag,
          visitedRegionIds: progress.visitedRegionIds,
          from: progress.currentRegionId,
          to: selectedId,
        })
      : null;
  const isTrialEdge =
    !!selectedId &&
    isAdjacent &&
    selectedReq?.kind === "trial" &&
    !isTrialCleared(selectedReq.enemiesFrom);
  // 시련 엣지는 met=false 라도 "도전" 액션으로 진입 가능 — canMove 와 별도로 처리.
  const canMove =
    !!selectedId &&
    selectedId !== progress.currentRegionId &&
    isAdjacent &&
    (requirementStatus?.met ?? true);
  const canChallenge = isTrialEdge;

  const performMove = (toId: RegionId) => {
    const isFirstVisit = !progress.visitedRegionIds.includes(toId);
    onProgressChange({
      ...progress,
      currentRegionId: toId,
      visitedRegionIds: isFirstVisit
        ? [...progress.visitedRegionIds, toId]
        : progress.visitedRegionIds,
    });
    if (isFirstVisit) {
      const region = WORLD_MAP.regions.find((r) => r.id === toId);
      if (region) {
        addNotification(
          "info",
          `${region.name}에 처음 도착했다 — ${region.description}`,
        );
      }
    }
  };

  const handleMove = () => {
    if (!selectedId) return;
    if (playerHp <= 0) {
      setLowHpBlocked(true);
      return;
    }
    if (canChallenge && !canMove) {
      // 시련 도전 — 자동 전투 N전 시작.
      onTrialStart(progress.currentRegionId, selectedId);
      return;
    }
    if (!canMove) return;
    performMove(selectedId);
  };

  const currentRegion = WORLD_MAP.regions.find(
    (r) => r.id === progress.currentRegionId,
  );

  return (
    <div className="space-y-3">
      <Card padding="none" className="overflow-hidden">
        <MapCanvas
          world={WORLD_MAP.viewBox}
          focusX={currentRegion?.position.x ?? WORLD_MAP.viewBox.width / 2}
          focusY={currentRegion?.position.y ?? WORLD_MAP.viewBox.height / 2}
        >
          {WORLD_MAP.edges.map((edge) => {
            const from = WORLD_MAP.regions.find((r) => r.id === edge.from);
            const to = WORLD_MAP.regions.find((r) => r.id === edge.to);
            if (!from || !to) return null;
            // 마을 직통 (fast-travel) 엣지는 지도에 그리지 않는다 — 길게 가로지르는
            // 라인이 다른 엣지/노드 위로 어지럽게 겹친다. 발견된 마을 노드가 "방문함"
            // 상태로 표시되고 클릭하면 이동 버튼이 뜨므로 기능은 유지된다.
            if (edge.requires?.kind === "visited") return null;
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
        </MapCanvas>
      </Card>
      <RegionDetail
        region={selectedRegion}
        state={selectedState}
        canMove={canMove}
        canChallenge={canChallenge}
        onMove={handleMove}
        requirementStatus={requirementStatus}
      />
      {lowHpBlocked && (
        <LowHpBlockModal onConfirm={() => setLowHpBlocked(false)} />
      )}
    </div>
  );
}

function LowHpBlockModal({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <Card padding="lg" className="w-full max-w-sm text-center">
        <div className="text-lg font-semibold text-rose-600 dark:text-rose-400">
          움직일 수가 없다
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          체력이 너무 낮아 한 발짝도 떼기 힘들다...
          <br />
          일단 치유소로 가서 회복부터 하자.
        </p>
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
