// 단계 1: 목격 (kills < 5) — 실루엣 + 이름만
// 단계 2: 처치 5회+ — HP 공개
// 단계 3: 처치 300회+ — ATK/DEF/SPD + 스킬 + 드랍 종류 공개
// 단계 4: 처치 1000회+ — EXP + 드랍 확률(%) 공개
// 1000/3000 이 너무 빡빡해 도감 완성이 막막하다는 피드백 → 300/1000 으로 완화.
// 보스/미니보스급은 그래도 단계 3~4 에 도달하기 어려워 영구 미지로 남는 의도된 디자인은 유지.
export type MonsterRevealStage = 1 | 2 | 3 | 4;

export const MONSTER_THRESHOLDS = [5, 300, 1000] as const;

export function getRevealStage(kills: number): MonsterRevealStage {
  if (kills >= 1000) return 4;
  if (kills >= 300) return 3;
  if (kills >= 5) return 2;
  return 1;
}

export function getKillsToNextStage(kills: number): number | null {
  if (kills < 5) return 5 - kills;
  if (kills < 300) return 300 - kills;
  if (kills < 1000) return 1000 - kills;
  return null;
}
