// 고탑 보스층 클리어 보상 — 매 클리어마다 (마일스톤 첫 도달과 별개) 굴리는 룬 드롭 + 토큰.
//
// 마일스톤(rewards.ts) 은 "첫 도달 1회" 보상, 이 파일은 매 보스 클리어마다 적용.
// 서버 권위 — apply.ts 가 호출, anti-cheat. 클라는 결과만 받는다.

import { RUNE_IDS, type RuneGrade, type RuneId } from "@/adventure/data/runes";

export type RuneDropEntry = {
  id: RuneId;
  grade: RuneGrade;
  count: number;
};

export type BossClearReward = {
  /** 매 보스 클리어 시 떨어지는 토큰 수. */
  tokens: number;
  /** 굴려진 룬 드롭 — 0~N개. */
  runes: RuneDropEntry[];
};

// 층대별 등급 분포 — 합이 1.0 이 되도록.
// 층이 높을수록 상위 등급 확률 ↑, 하위 등급 확률 ↓.
type GradeWeights = Partial<Record<RuneGrade, number>>;

function gradeWeightsForFloor(floor: number): GradeWeights {
  // 다섯 구간으로 나눠 점진 전환.
  if (floor < 30) return { 1: 1.0 };
  if (floor < 50) return { 1: 0.7, 2: 0.3 };
  if (floor < 70) return { 1: 0.4, 2: 0.5, 3: 0.1 };
  if (floor < 90) return { 2: 0.3, 3: 0.5, 4: 0.2 };
  if (floor < 110) return { 3: 0.3, 4: 0.5, 5: 0.2 };
  return { 3: 0.15, 4: 0.45, 5: 0.4 };
}

// 보스 클리어당 떨어지는 룬 개수 기댓값. 층이 높을수록 더 많이.
// 1.0 이면 항상 1개, 1.5 면 50% 확률로 2개째.
function expectedDropsForFloor(floor: number): number {
  if (floor < 30) return 1.0;
  if (floor < 60) return 1.2;
  if (floor < 100) return 1.5;
  return 2.0;
}

// 보스층당 토큰 — 마일스톤 보너스 외에 매번 떨어진다.
function tokensForFloor(floor: number): number {
  if (floor < 30) return 1;
  if (floor < 60) return 2;
  if (floor < 100) return 3;
  return 5;
}

// 등급 가중 추첨 — Object.entries 가 키를 string 으로 돌려주므로 Number 변환 필수.
function pickGrade(weights: GradeWeights, rng: () => number): RuneGrade {
  const entries = Object.entries(weights) as [string, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return Number(entries[0][0]) as RuneGrade;
  let roll = rng() * total;
  for (const [k, w] of entries) {
    roll -= w;
    if (roll < 0) return Number(k) as RuneGrade;
  }
  return Number(entries[entries.length - 1][0]) as RuneGrade;
}

/**
 * 한 보스층 클리어로 굴려지는 보상.
 * - 토큰은 항상 지급 (층대별 N개).
 * - 룬은 expectedDrops 의 정수 부분 + (소수 부분 확률) 만큼 굴려, 각 굴림마다 룬 종류 균등 × 등급 가중 추첨.
 *
 * 결정성: rng 를 외부에서 받아 단위 테스트 가능. 호출자는 Math.random 을 주입.
 */
export function rollBossClearReward(
  floor: number,
  rng: () => number = Math.random,
): BossClearReward {
  const tokens = tokensForFloor(floor);
  const expected = expectedDropsForFloor(floor);
  const guaranteed = Math.floor(expected);
  const extraChance = expected - guaranteed;
  // extraChance 가 0 이면 rng 소비도 skip — 시드 시퀀스가 어긋나지 않게.
  const rolls =
    guaranteed + (extraChance > 0 && rng() < extraChance ? 1 : 0);

  const weights = gradeWeightsForFloor(floor);
  const drops: RuneDropEntry[] = [];
  for (let i = 0; i < rolls; i += 1) {
    const id = RUNE_IDS[Math.floor(rng() * RUNE_IDS.length)];
    const grade = pickGrade(weights, rng);
    // 같은 (id, grade) 가 같은 굴림에서 또 떨어지면 count 합산 (인벤 add 호출 횟수 절약).
    const existing = drops.find((d) => d.id === id && d.grade === grade);
    if (existing) existing.count += 1;
    else drops.push({ id, grade, count: 1 });
  }

  return { tokens, runes: drops };
}
