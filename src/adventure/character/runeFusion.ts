import type { RuneGrade, RuneId } from "@/adventure/data/runes";

// 합성 패턴 — 1~4 → 2~5: 동일 (id, grade) 룬 ×3 → grade+1 ×1.
// 5 → 6: 5막 PR-D1 흡수 강화. 5등급 ×1 + 별빛 조각 ×20 → 6등급 ×1.
//   별빛 조각은 5막 「빈 옥좌의 시대」 전용 자원이라 4막 클리어 전에는 6등급 진입 불가.
// 6등급은 합성 불가 (최상위). 합성 후 잔량 0 이면 호출부가 인벤 정리.

export const RUNE_FUSION_COST = 3;
export const STARLIT_FUSION_RUNE_COST = 1;
export const STARLIT_FUSION_SHARD_COST = 20;

export type FusionPlan = {
  id: RuneId;
  fromGrade: RuneGrade;
  toGrade: RuneGrade;
  consumed: number; // 1~4 → +1: RUNE_FUSION_COST(3) / 5 → 6: STARLIT_FUSION_RUNE_COST(1)
  produced: number; // 항상 1
  /** 5 → 6 흡수 강화 한정 — 별빛 조각 추가 소비. 그 외 등급에서는 undefined. */
  extraMaterial?: { id: "starfall_shard"; count: number };
};

export type FusionError =
  | "max_grade" // 6등급은 합성 불가
  | "insufficient" // 룬 보유량 부족
  | "insufficient_shard"; // 5 → 6 강화에 별빛 조각 부족 (별빛 조각만 부족, 룬은 충분)

export function planRuneFusion(
  id: RuneId,
  fromGrade: RuneGrade,
  have: number,
  shardCount = 0,
): FusionPlan | FusionError {
  if (fromGrade >= 6) return "max_grade";
  if (fromGrade === 5) {
    // 5 → 6 흡수 강화
    if (have < STARLIT_FUSION_RUNE_COST) return "insufficient";
    if (shardCount < STARLIT_FUSION_SHARD_COST) return "insufficient_shard";
    return {
      id,
      fromGrade: 5,
      toGrade: 6,
      consumed: STARLIT_FUSION_RUNE_COST,
      produced: 1,
      extraMaterial: { id: "starfall_shard", count: STARLIT_FUSION_SHARD_COST },
    };
  }
  // 1~4 → 2~5
  if (have < RUNE_FUSION_COST) return "insufficient";
  return {
    id,
    fromGrade,
    toGrade: (fromGrade + 1) as RuneGrade,
    consumed: RUNE_FUSION_COST,
    produced: 1,
  };
}

export function isFusionError(v: FusionPlan | FusionError): v is FusionError {
  return typeof v === "string";
}
