// 단계 1: 목격 (kills < 5) — 실루엣 + 이름만
// 단계 2: 처치 5회+ — HP 공개
// 단계 3: 처치 1000회+ — ATK/DEF/SPD + 스킬 + 드랍 종류 공개
// 단계 4: 처치 3000회+ — EXP + 드랍 확률(%) 공개
// 도감 완성을 장기 목표로 두고 임계를 크게 올린 값 (옛 1/30/50 의 5×/33×/60×).
// 보스/미니보스급은 사실상 단계 3~4 에 도달하기 어려워 영구 미지로 남는 의도된 디자인.
export type MonsterRevealStage = 1 | 2 | 3 | 4;

export const MONSTER_THRESHOLDS = [5, 1000, 3000] as const;

export function getRevealStage(kills: number): MonsterRevealStage {
  if (kills >= 3000) return 4;
  if (kills >= 1000) return 3;
  if (kills >= 5) return 2;
  return 1;
}

export function getKillsToNextStage(kills: number): number | null {
  if (kills < 5) return 5 - kills;
  if (kills < 1000) return 1000 - kills;
  if (kills < 3000) return 3000 - kills;
  return null;
}
