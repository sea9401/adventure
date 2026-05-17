"use client";

import { useEffect, useRef, useState } from "react";
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
import { useModalA11y } from "@/lib/useModalA11y";
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
  const { addNotification, inventory, handleUseTownReturn, autoHunt } = useGame();
  const scrollCount = inventory.consumableCount("scroll_town_return");
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
  const requirementStatus: EdgeRequirementStatus | null = (() => {
    if (!selectedId) return null;
    if (isAdjacent) {
      return evaluateEdgeRequirement(selectedReq, {
        log,
        isTrialCleared,
        hasStoryFlag,
        visitedRegionIds: progress.visitedRegionIds,
        from: progress.currentRegionId,
        to: selectedId,
      });
    }
    // locked 지역 — 진입 경로의 첫 번째 미충족 조건을 힌트로 노출.
    if (selectedState === "locked") {
      const inbound = WORLD_MAP.edges.filter(
        (e) => e.to === selectedId && e.requires?.kind !== "visited",
      );
      for (const edge of inbound) {
        const s = evaluateEdgeRequirement(edge.requires, {
          log,
          isTrialCleared,
          hasStoryFlag,
          visitedRegionIds: progress.visitedRegionIds,
        });
        if (!s.met) return s;
      }
    }
    return null;
  })();
  const isTrialEdge =
    !!selectedId &&
    isAdjacent &&
    selectedReq?.kind === "trial" &&
    !isTrialCleared(selectedReq.enemiesFrom);
  const huntDispatched = autoHunt.isDispatched;
  // 시련 엣지는 met=false 라도 "도전" 액션으로 진입 가능 — canMove 와 별도로 처리.
  // 단, 위탁 원정 중에는 시련(자동 전투) 도전 불가 — 라이브 사냥·보스 도전과 동일 정책.
  const canMove =
    !!selectedId &&
    selectedId !== progress.currentRegionId &&
    isAdjacent &&
    (requirementStatus?.met ?? true);
  const canChallenge = isTrialEdge && !huntDispatched;

  // 마을 귀환 주문서로 이동 가능 여부 — 가본 마을이고, 정상 경로(canMove/canChallenge)
  // 가 안 풀리는 상황에서만 노출. 출발지가 마을이면 fast-travel 엣지로 무료 이동 가능
  // 하므로 주문서 모드 자체를 띄우지 않는다 (count 표시 + 소비 일관성).
  const fromRegion = WORLD_MAP.regions.find(
    (r) => r.id === progress.currentRegionId,
  );
  const fromIsTown = !!fromRegion?.tags?.includes("town");
  const targetIsTown = !!selectedRegion?.tags?.includes("town");
  const isScrollEligible =
    !!selectedId &&
    selectedId !== progress.currentRegionId &&
    targetIsTown &&
    visitedSet.has(selectedId) &&
    !fromIsTown &&
    !canMove &&
    !canChallenge;

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
    if (canMove) {
      performMove(selectedId);
      return;
    }
    if (isScrollEligible && scrollCount > 0) {
      // 주문서 소비 + 텔레포트 — handleUseTownReturn 가 mapProgress 까지 갱신.
      handleUseTownReturn(selectedId);
      return;
    }
  };

  // PC 편의 — Space / Enter 로 "이동" 버튼 발화. 텍스트 입력 / 다른 버튼·링크에 포커스가
  // 있을 때는 그쪽의 기본 동작에 양보(이중 발화 방지). 모바일은 가상 키보드만 있어 영향 없음.
  // canMove / canChallenge / 주문서 셋 중 하나라도 가능할 때만 발화.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      if (e.repeat) return; // 키 길게 누름으로 인한 반복 발화 차단.
      const ae = document.activeElement as HTMLElement | null;
      if (ae) {
        const tag = ae.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          tag === "BUTTON" ||
          tag === "A" ||
          ae.isContentEditable
        )
          return;
      }
      if (lowHpBlocked) return;
      const canFire =
        canMove ||
        canChallenge ||
        (isScrollEligible && scrollCount > 0);
      if (!canFire) return;
      e.preventDefault(); // Space 의 페이지 스크롤 기본 동작 차단.
      handleMove();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // handleMove 는 매 렌더 새로 만들어지지만 effect 가 매 렌더 재바인딩되는 비용은 작음.
    // 의존성 명시로 closure 가 항상 최신 selectedId / 플래그를 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canMove, canChallenge, isScrollEligible, scrollCount, lowHpBlocked]);

  const currentRegion = WORLD_MAP.regions.find(
    (r) => r.id === progress.currentRegionId,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 px-1 text-sm">
        <span className="text-base leading-none">📍</span>
        <span className="text-zinc-500 dark:text-zinc-400">현재 위치</span>
        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
          {currentRegion?.name ?? "—"}
        </span>
      </div>
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
      {isTrialEdge && huntDispatched && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          자동 사냥(원정) 중에는 시련에 도전할 수 없습니다 — 원정을 먼저
          수령하세요.
        </div>
      )}
      <RegionDetail
        region={selectedRegion}
        state={selectedState}
        canMove={canMove}
        canChallenge={canChallenge}
        onMove={handleMove}
        requirementStatus={requirementStatus}
        scrollMove={isScrollEligible ? { count: scrollCount } : undefined}
      />
      {lowHpBlocked && (
        <LowHpBlockModal onConfirm={() => setLowHpBlocked(false)} />
      )}
    </div>
  );
}

function LowHpBlockModal({ onConfirm }: { onConfirm: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  useModalA11y(contentRef);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="low-hp-block-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
    >
      <div ref={contentRef} className="w-full max-w-sm">
        <Card padding="lg" className="text-center">
        <div
          id="low-hp-block-title"
          className="text-lg font-semibold text-rose-600 dark:text-rose-400"
        >
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
    </div>
  );
}
