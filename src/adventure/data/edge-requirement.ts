import type { AdventureLog } from "../log/storage";
import {
  WORLD_MAP,
  type EdgeRequirement,
  type RegionId,
} from "./world";

export type EdgeRequirementStatus = {
  met: boolean;
  progress?: { current: number; total: number; label: string };
};

export function evaluateEdgeRequirement(
  req: EdgeRequirement | undefined,
  log: AdventureLog,
): EdgeRequirementStatus {
  if (!req) return { met: true };

  if (req.bestiaryOf) {
    const region = WORLD_MAP.regions.find((r) => r.id === req.bestiaryOf);
    if (!region || region.enemies.length === 0) return { met: true };
    const total = region.enemies.length;
    const current = region.enemies.filter(
      (name) => log.monsters[name]?.encountered,
    ).length;
    return {
      met: current === total,
      progress: {
        current,
        total,
        label: `${region.name}의 모험의 서`,
      },
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
