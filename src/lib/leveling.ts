// 캐릭터 레벨링 시스템.
// - 만렙 50.
// - 다음 레벨까지 필요한 EXP = floor(100 * level^1.5). Lv1→2 = 100.
// - 레벨업당 스탯 포인트 1점 획득(호출측에서 분배).

export const MAX_LEVEL = 50;

export function requiredExpToNext(level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  if (level < 1) return null;
  return Math.floor(100 * Math.pow(level, 1.5));
}

// EXP 누적 적용 + 자동 레벨업 처리.
// 누적 EXP가 다음 레벨 임계치를 넘으면 레벨업하고 다음 임계치로 계속 진행.
// 만렙 도달 시 잉여 EXP는 0으로 캡.
export function applyExpGain(
  level: number,
  exp: number,
  gain: number,
): { level: number; exp: number; levelsGained: number } {
  let nextLevel = Math.max(1, Math.min(MAX_LEVEL, level));
  let nextExp = Math.max(0, exp + gain);
  let levelsGained = 0;
  while (nextLevel < MAX_LEVEL) {
    const need = requiredExpToNext(nextLevel)!;
    if (nextExp < need) break;
    nextExp -= need;
    nextLevel += 1;
    levelsGained += 1;
  }
  if (nextLevel >= MAX_LEVEL) nextExp = 0;
  return { level: nextLevel, exp: nextExp, levelsGained };
}

// UI 노출용 — 레벨별 필요 EXP 테이블.
export type LevelTableRow = {
  level: number;
  required: number;
  cumulative: number;
};

export function getLevelTable(): LevelTableRow[] {
  const rows: LevelTableRow[] = [];
  let cumulative = 0;
  for (let lv = 1; lv < MAX_LEVEL; lv += 1) {
    const required = requiredExpToNext(lv)!;
    cumulative += required;
    rows.push({ level: lv, required, cumulative });
  }
  return rows;
}
