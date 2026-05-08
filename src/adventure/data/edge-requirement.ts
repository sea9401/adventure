import type { AdventureLog } from "../log/storage";
import {
  WORLD_MAP,
  type EdgeRequirement,
  type EdgeRequirementKind,
  type RegionId,
} from "./world";

export type EdgeRequirementStatus = {
  met: boolean;
  /** 시련처럼 "도전" 액션을 거쳐야 하는 종류면 true. UI 가 다른 버튼을 보여줄 수 있게. */
  challengeable?: boolean;
  /** 진행도 (보유/필요) 표시용. */
  progress?: { current: number; total: number; label: string };
  /** 미충족 사유 한 줄 — UI 노출용. */
  reason?: string;
  /** 조건 종류. UI 측에서 분기 처리 시 사용. */
  kind?: EdgeRequirementKind;
};

export type EvaluateContext = {
  log: AdventureLog;
  /** 이미 해금된 엣지면 모든 조건을 충족된 것으로 간주 (시련 등 영구 해금용). */
  isEdgeUnlocked?: (from: RegionId, to: RegionId) => boolean;
  from?: RegionId;
  to?: RegionId;
};

export function evaluateEdgeRequirement(
  req: EdgeRequirement | undefined,
  ctx: EvaluateContext,
): EdgeRequirementStatus {
  if (!req) return { met: true };

  // 영구 해금된 엣지는 종류 무관 즉시 통과.
  if (
    ctx.from &&
    ctx.to &&
    ctx.isEdgeUnlocked?.(ctx.from, ctx.to)
  ) {
    return { met: true, kind: req.kind };
  }

  if (req.kind === "bestiary") {
    const region = WORLD_MAP.regions.find((r) => r.id === req.regionId);
    if (!region || region.enemies.length === 0) {
      return { met: true, kind: "bestiary" };
    }
    const total = region.enemies.length;
    const current = region.enemies.filter(
      (name) => ctx.log.monsters[name]?.encountered,
    ).length;
    return {
      met: current === total,
      kind: "bestiary",
      progress: {
        current,
        total,
        label: `${region.name}의 모험의 서`,
      },
    };
  }

  if (req.kind === "trial") {
    const target = WORLD_MAP.regions.find((r) => r.id === req.enemiesFrom);
    const label = target
      ? `${target.name} 시련 (${req.battles}전 연승)`
      : `시련 (${req.battles}전 연승)`;
    return {
      met: false,
      challengeable: true,
      kind: "trial",
      reason: `${label} 통과 필요`,
      progress: { current: 0, total: req.battles, label },
    };
  }

  return { met: true };
}

export function findEdgeRequirement(
  fromId: RegionId,
  toId: RegionId,
): EdgeRequirement | undefined {
  const edge = WORLD_MAP.edges.find((e) => e.from === fromId && e.to === toId);
  return edge?.requires;
}
