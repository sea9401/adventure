import type { AchievementId, GameStats } from "./types";
import { ACHIEVEMENTS } from "./data";

// 새로 클레임할 업적 — 단일 업적 ID 또는 (tieredId, tier) 쌍
export type AchievementClaim =
  | { kind: "single"; id: AchievementId }
  | { kind: "tier"; id: AchievementId; tier: number };

export const checkAchievements = (
  stats: GameStats,
  unlocked: AchievementId[],
  claimedTiers: Partial<Record<AchievementId, number>>,
): AchievementClaim[] => {
  const newClaims: AchievementClaim[] = [];
  for (const id of Object.keys(ACHIEVEMENTS) as AchievementId[]) {
    const def = ACHIEVEMENTS[id];
    if (def.kind === "single") {
      if (unlocked.includes(id)) continue;
      if (def.check(stats)) newClaims.push({ kind: "single", id });
    } else {
      const claimed = claimedTiers[id] ?? 0;
      const value = def.metric(stats);
      // 모든 미클레임 티어 중 도달한 것 모두 push
      for (let i = claimed; i < def.tiers.length; i++) {
        if (value >= def.tiers[i].goal) {
          newClaims.push({ kind: "tier", id, tier: i + 1 });
        } else {
          break;
        }
      }
    }
  }
  return newClaims;
};
