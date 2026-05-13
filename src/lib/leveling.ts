// 캐릭터 레벨링 시스템.
// - 만렙 70.
// - Lv 1~34: floor(120 * level^1.5).  Lv1→2 = 120.
// - Lv 35~59: floor(120 * level^2.5 / 35).  35레벨 경계에서 연속, 이후 가팔라짐.
// - Lv 60~69: 위 곡선에 (level-60)/30 만큼 선형 가산 (×1.00→×1.30 램프).
//             엔드게임 구간을 더 무겁게 — 60~70 총 요구치 ≈ 50~60 의 1.75배.
// - 레벨업당 스탯 포인트 1점 획득(호출측에서 분배).

export const MAX_LEVEL = 70;

// 서버 전역 EXP 배율 — 테스트 서버용. 빌드 시 NEXT_PUBLIC_XP_RATE_MULT=5 처럼 주입.
// NEXT_PUBLIC_ 접두사라 클라/서버 양쪽에서 같은 값. 신참 ×2 와 길드 expMult 와는 곱해짐.
// 안전 범위 [0.1, 100] 클램프, 파싱 실패/미설정 시 1.
function parseXpRateMult(): number {
  const raw = process.env.NEXT_PUBLIC_XP_RATE_MULT;
  if (!raw) return 1;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(100, Math.max(0.1, n));
}

export const XP_RATE_MULT = parseXpRateMult();

// 신참 보너스 — 8레벨 미만이면 사냥/퀘스트 EXP 가 ×2.
// 레벨업으로 조건이 깨지는 순간 자동으로 꺼진다 (기존 캐릭터 포함).
export const NEWBIE_BONUS_LEVEL_THRESHOLD = 8;
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

// 35레벨 기준으로 지수를 1.5 → 2.5로 전환. 경계값이 동일하도록 계수를 맞춤:
// 120 * 35^1.5 = (120/35) * 35^2.5  →  계수 = 120 / 35.
const STEEP_LEVEL = 35;
const STEEP_COEFF = 120 / STEEP_LEVEL;

// 60레벨부터 엔드게임 가산 — 기본 곡선에 (level-60)/30 만큼 선형 추가.
// 60→69 에서 ×1.00 → ×1.30 으로 램프. 경계(Lv60)에서 연속.
const ENDGAME_LEVEL = 60;
const ENDGAME_RAMP_DIVISOR = 30;

export function requiredExpToNext(level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  if (level < 1) return null;
  if (level < STEEP_LEVEL) {
    return Math.floor(120 * Math.pow(level, 1.5));
  }
  const base = STEEP_COEFF * Math.pow(level, 2.5);
  if (level < ENDGAME_LEVEL) {
    return Math.floor(base);
  }
  return Math.floor(
    base * (1 + (level - ENDGAME_LEVEL) / ENDGAME_RAMP_DIVISOR),
  );
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
