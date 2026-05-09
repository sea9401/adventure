// 캐릭터 레벨링 시스템.
// - 만렙 50.
// - 다음 레벨까지 필요한 EXP = floor(120 * level^1.5). Lv1→2 = 120.
// - 레벨업당 스탯 포인트 1점 획득(호출측에서 분배).

export const MAX_LEVEL = 50;

// 신참 보너스 — 5레벨 미만이면 사냥/퀘스트 EXP 가 ×2.
// 레벨업으로 조건이 깨지는 순간 자동으로 꺼진다 (기존 캐릭터 포함).
export const NEWBIE_BONUS_LEVEL_THRESHOLD = 5;
export const NEWBIE_EXP_MULTIPLIER = 2;

export function isNewbieBonusActive(level: number): boolean {
  return level < NEWBIE_BONUS_LEVEL_THRESHOLD;
}

export function applyNewbieBonus(
  exp: number,
  level: number,
): { gained: number; bonusApplied: boolean } {
  if (exp <= 0 || !isNewbieBonusActive(level)) {
    return { gained: exp, bonusApplied: false };
  }
  return { gained: exp * NEWBIE_EXP_MULTIPLIER, bonusApplied: true };
}

export function requiredExpToNext(level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  if (level < 1) return null;
  return Math.floor(120 * Math.pow(level, 1.5));
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
