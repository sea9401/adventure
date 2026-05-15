// 단계 1: 목격 — 실루엣 + 이름만
// 단계 2: HP 공개
// 단계 3: ATK/DEF/SPD + 스킬 + 드랍 종류 공개
// 단계 4: EXP + 드랍 확률(%) 공개
//
// 일반 잡몹: [5, 300, 1000]. 1000/3000 이 너무 빡빡하다는 피드백 후 300/1000 으로 완화.
// 보스: [1, 5, 10]. dailyEntryLimit·협동 쿨다운 등으로 매일 잡을 수 있는 횟수가 극히 적어
//   같은 임계를 적용하면 사실상 영구 stage 1. 1회 처치 인증 → 5회 → 10회 로 차등.
export type MonsterRevealStage = 1 | 2 | 3 | 4;

export const MONSTER_THRESHOLDS = [5, 300, 1000] as const;
export const BOSS_MONSTER_THRESHOLDS = [1, 5, 10] as const;

export function getRevealStage(
  kills: number,
  isBoss: boolean = false,
): MonsterRevealStage {
  const t = isBoss ? BOSS_MONSTER_THRESHOLDS : MONSTER_THRESHOLDS;
  if (kills >= t[2]) return 4;
  if (kills >= t[1]) return 3;
  if (kills >= t[0]) return 2;
  return 1;
}

export function getKillsToNextStage(
  kills: number,
  isBoss: boolean = false,
): number | null {
  const t = isBoss ? BOSS_MONSTER_THRESHOLDS : MONSTER_THRESHOLDS;
  if (kills < t[0]) return t[0] - kills;
  if (kills < t[1]) return t[1] - kills;
  if (kills < t[2]) return t[2] - kills;
  return null;
}
