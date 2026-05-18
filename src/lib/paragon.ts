// 100레벨 도달 후 초과 EXP 를 적립해 6트랙으로 분배하는 시스템.
// PR-A 범위: 데이터/EXP 적립/곡선. UI 와 효과 적용은 후속 PR.
//
// 곡선:
// - 1pt 비용 = 99→100 비용 (`requiredExpToNext(99)`)
// - n번째 pt 비용 = 1pt 비용 × 1.15^(n-1)
// - 총 캡 = 150포인트 (트랙 6 × 트랙당 25). 풀졸업 EXP 는 사실상 평생급.

import { requiredExpToNext } from "./leveling";

export const PARAGON_TRACKS = [
  "wrath", // 분노 — flat ATK
  "guard", // 수호 — flat DEF
  "vigor", // 활력 — %maxHP
  "precision", // 정밀 — %p crit rate
  "blast", // 폭격 — %p crit damage
  "fortune", // 풍요 — % gold/exp
] as const;

export type ParagonTrackKey = (typeof PARAGON_TRACKS)[number];

export const PARAGON_TRACK_CAP = 25;
export const PARAGON_TOTAL_CAP = PARAGON_TRACK_CAP * PARAGON_TRACKS.length;

export const PARAGON_TRACK_LABELS: Record<ParagonTrackKey, string> = {
  wrath: "분노",
  guard: "수호",
  vigor: "활력",
  precision: "정밀",
  blast: "폭격",
  fortune: "풍요",
};

// 트랙별 1pt 효과. PR-C 에서 derivePlayerCombat / onBattleEnd 가 참조.
// "perPoint" 의미는 kind 마다 다름:
//   flatAtk / flatDef        — 정수 가산
//   pctMaxHp                  — % 가산 (1.0 = +1%)
//   ppCritRate / ppCritDmg    — %p 가산 (1.0 = +1%p)
//   pctGoldExp                — % 가산 (1.0 = +1%)
export const PARAGON_TRACK_EFFECTS: Record<
  ParagonTrackKey,
  {
    kind:
      | "flatAtk"
      | "flatDef"
      | "pctMaxHp"
      | "ppCritRate"
      | "ppCritDmg"
      | "pctGoldExp";
    perPoint: number;
  }
> = {
  wrath: { kind: "flatAtk", perPoint: 1 },
  guard: { kind: "flatDef", perPoint: 1 },
  vigor: { kind: "pctMaxHp", perPoint: 0.4 },
  precision: { kind: "ppCritRate", perPoint: 0.2 },
  blast: { kind: "ppCritDmg", perPoint: 0.5 },
  fortune: { kind: "pctGoldExp", perPoint: 0.5 },
};

export type ParagonState = {
  /** 100 도달 후 누적 파라곤 EXP. 캡 이후 추가 EXP 는 폐기. */
  paragonExp: number;
  /** 트랙별 할당 포인트. 미할당 트랙은 키 자체가 없음. 각 트랙 ≤ PARAGON_TRACK_CAP. */
  allocations: Partial<Record<ParagonTrackKey, number>>;
};

export const initialParagonState: ParagonState = {
  paragonExp: 0,
  allocations: {},
};

const PT_GROWTH = 1.15;

/** 1pt 비용 (99→100 비용). 모듈 로드 시 1회 계산. */
const BASE_PT_COST = (() => {
  const v = requiredExpToNext(99);
  // requiredExpToNext(99) 가 null 이 되는 경우는 없어야 하지만 안전망.
  return v == null ? 0 : v;
})();

/** n번째(1-based) 포인트 비용. */
export function paragonPointCost(pointIndex: number): number {
  if (pointIndex < 1 || pointIndex > PARAGON_TOTAL_CAP) return 0;
  return Math.floor(BASE_PT_COST * Math.pow(PT_GROWTH, pointIndex - 1));
}

/** n개 포인트를 사기 위한 누적 EXP 비용. */
export function cumulativeExpForPoints(points: number): number {
  if (points <= 0) return 0;
  const cap = Math.min(points, PARAGON_TOTAL_CAP);
  let sum = 0;
  for (let i = 1; i <= cap; i += 1) sum += paragonPointCost(i);
  return sum;
}

/** EXP 캡 — PARAGON_TOTAL_CAP 포인트 도달에 필요한 누적 EXP. 이를 넘으면 적립 중단. */
export const PARAGON_EXP_CAP = cumulativeExpForPoints(PARAGON_TOTAL_CAP);

/** 누적 EXP 에서 살 수 있는 포인트 수. */
export function pointsFromExp(exp: number): number {
  if (exp <= 0) return 0;
  let acc = 0;
  for (let i = 1; i <= PARAGON_TOTAL_CAP; i += 1) {
    acc += paragonPointCost(i);
    if (acc > exp) return i - 1;
  }
  return PARAGON_TOTAL_CAP;
}

/** 현재 보유 EXP 기준 다음 포인트까지 남은 EXP. 캡 상태면 0. */
export function expToNextPoint(exp: number): number {
  const pts = pointsFromExp(exp);
  if (pts >= PARAGON_TOTAL_CAP) return 0;
  return Math.max(0, cumulativeExpForPoints(pts + 1) - exp);
}

/** 들어온 EXP 를 적립 — 캡 초과분은 폐기. */
export function addParagonExp(state: ParagonState, gain: number): ParagonState {
  if (gain <= 0) return state;
  const next = Math.min(state.paragonExp + gain, PARAGON_EXP_CAP);
  if (next === state.paragonExp) return state;
  return { ...state, paragonExp: next };
}

/** 총 할당 포인트. */
export function totalAllocated(state: ParagonState): number {
  let sum = 0;
  for (const k of PARAGON_TRACKS) sum += state.allocations[k] ?? 0;
  return sum;
}

/** 미할당 포인트 (현 시점 살 수 있는 포인트 - 할당 합). */
export function unspentPoints(state: ParagonState): number {
  return Math.max(0, pointsFromExp(state.paragonExp) - totalAllocated(state));
}

/** 저장된 raw 를 정규화. 잘못된 값은 안전 디폴트로. */
export function readInitialParagon(raw: unknown): ParagonState {
  if (!raw || typeof raw !== "object") return initialParagonState;
  const r = raw as Partial<ParagonState>;
  const allocations: Partial<Record<ParagonTrackKey, number>> = {};
  const rawAlloc = r.allocations;
  if (rawAlloc && typeof rawAlloc === "object") {
    const lookup = rawAlloc as Record<string, unknown>;
    for (const k of PARAGON_TRACKS) {
      const v = lookup[k];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        allocations[k] = Math.max(
          0,
          Math.min(PARAGON_TRACK_CAP, Math.floor(v)),
        );
      }
    }
  }
  const paragonExp =
    typeof r.paragonExp === "number" && Number.isFinite(r.paragonExp)
      ? Math.max(0, Math.min(PARAGON_EXP_CAP, r.paragonExp))
      : 0;
  return { paragonExp, allocations };
}
