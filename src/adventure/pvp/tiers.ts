// PvP 티어 — Elo 정수 → 티어 메타. ELO_INITIAL=1000 에서 시작해 ±200 마다 한 단계.
//
//   Bronze   < 1000
//   Silver   1000 - 1199
//   Gold     1200 - 1399
//   Platinum 1400 - 1599
//   Diamond  1600 - 1799
//   Master   ≥ 1800
//
// 다음 티어까지 남은 점수 (progress 막대용) 도 같이 제공.

export type PvPTierKey =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master";

export type PvPTier = {
  key: PvPTierKey;
  name: string;
  /** 이 티어의 시작점. 0(=Bronze) ~ 1800(=Master). */
  threshold: number;
  /** 다음 티어 임계 (없으면 null — Master). */
  nextThreshold: number | null;
  /** 텍스트 색 (Tailwind 클래스). */
  color: string;
};

const TIERS: PvPTier[] = [
  {
    key: "bronze",
    name: "브론즈",
    threshold: 0,
    nextThreshold: 1000,
    color: "text-amber-700 dark:text-amber-500",
  },
  {
    key: "silver",
    name: "실버",
    threshold: 1000,
    nextThreshold: 1200,
    color: "text-zinc-500 dark:text-zinc-300",
  },
  {
    key: "gold",
    name: "골드",
    threshold: 1200,
    nextThreshold: 1400,
    color: "text-amber-500 dark:text-amber-400",
  },
  {
    key: "platinum",
    name: "플래티넘",
    threshold: 1400,
    nextThreshold: 1600,
    color: "text-sky-500 dark:text-sky-300",
  },
  {
    key: "diamond",
    name: "다이아",
    threshold: 1600,
    nextThreshold: 1800,
    color: "text-violet-500 dark:text-violet-300",
  },
  {
    key: "master",
    name: "마스터",
    threshold: 1800,
    nextThreshold: null,
    color: "text-rose-500 dark:text-rose-300",
  },
];

export function tierFor(rating: number): PvPTier {
  let pick = TIERS[0];
  for (const t of TIERS) {
    if (rating >= t.threshold) pick = t;
  }
  return pick;
}

// 현재 레이팅의 티어 내 진행도 0~1 (Master 는 항상 1).
export function tierProgress(rating: number): number {
  const t = tierFor(rating);
  if (t.nextThreshold === null) return 1;
  const span = t.nextThreshold - t.threshold;
  const into = Math.max(0, rating - t.threshold);
  return Math.min(1, into / span);
}
