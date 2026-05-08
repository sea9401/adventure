// 단계 1: 목격 (encountered, kills=0)
// 단계 2: 처치 1회+ (kills >= 1)
// 단계 3: 처치 30회+ (kills >= 30)
// 단계 4: 처치 50회+ (kills >= 50)
export type MonsterRevealStage = 1 | 2 | 3 | 4;

export const MONSTER_THRESHOLDS = [1, 30, 50] as const;

export function getRevealStage(kills: number): MonsterRevealStage {
  if (kills >= 50) return 4;
  if (kills >= 30) return 3;
  if (kills >= 1) return 2;
  return 1;
}

export function getKillsToNextStage(kills: number): number | null {
  if (kills < 1) return 1 - kills;
  if (kills < 30) return 30 - kills;
  if (kills < 50) return 50 - kills;
  return null;
}
