// 백분위 칭호 산출 — cron 이 호출하는 순수 함수.
//
// 입력: 자격 통과(weekHighest >= TOWER_WEEKLY_MIN_FLOOR) 유저 리스트.
// 출력: userId → tierKey (TitleId 와 매핑). 자격 미달은 호출자가 사전 필터.
// 동률 처리: 같은 점수는 같은 tier. 임계선에 동률이 걸리면 더 좋은 tier 로 묶임
// (= 인심 좋은 cut-off — 같은 점수면 위 tier 와 같이 가는 게 자연스러움).

export type WeeklyTier = "top_1" | "top_5" | "top_10" | "top_25" | "top_50";

export const WEEKLY_TIER_TITLE_IDS: Record<WeeklyTier, string> = {
  top_1: "tower_weekly_top_1",
  top_5: "tower_weekly_top_5",
  top_10: "tower_weekly_top_10",
  top_25: "tower_weekly_top_25",
  top_50: "tower_weekly_top_50",
};

export type WeeklyQualifier = { userId: string; weekHighest: number };

const TIER_THRESHOLDS: { tier: WeeklyTier; pct: number }[] = [
  { tier: "top_1", pct: 0.01 },
  { tier: "top_5", pct: 0.05 },
  { tier: "top_10", pct: 0.1 },
  { tier: "top_25", pct: 0.25 },
  { tier: "top_50", pct: 0.5 },
];

function tierForRank(rank: number, total: number): WeeklyTier | null {
  const pct = rank / total;
  for (const t of TIER_THRESHOLDS) {
    if (pct <= t.pct) return t.tier;
  }
  return null;
}

/**
 * 자격 통과 유저들을 weekHighest 내림차순으로 받아 각자에게 한 tier 부여.
 * 동률은 같은 tier (인심 좋은 처리). 빈 입력은 빈 Map.
 */
export function computePercentileTitles(
  sortedQualifiers: ReadonlyArray<WeeklyQualifier>,
): Map<string, WeeklyTier> {
  const result = new Map<string, WeeklyTier>();
  const total = sortedQualifiers.length;
  if (total === 0) return result;

  let prevScore: number | null = null;
  let prevTier: WeeklyTier | null = null;
  for (let i = 0; i < total; i += 1) {
    const q = sortedQualifiers[i];
    let tier: WeeklyTier | null;
    if (prevScore !== null && q.weekHighest === prevScore) {
      tier = prevTier;
    } else {
      tier = tierForRank(i + 1, total);
    }
    if (tier) result.set(q.userId, tier);
    prevScore = q.weekHighest;
    prevTier = tier;
  }
  return result;
}
