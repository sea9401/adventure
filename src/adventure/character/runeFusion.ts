import type { RuneGrade, RuneId } from "@/adventure/data/runes";

// 동일 (id, grade) 룬 ×3 → 동일 id 의 grade+1 ×1.
// 5등급은 합성 불가 (최상위). 합성 후 잔량이 0이 되면 호출부가 인벤 정리.

export const RUNE_FUSION_COST = 3;

export type FusionPlan = {
  id: RuneId;
  fromGrade: RuneGrade;
  toGrade: RuneGrade;
  consumed: number; // 항상 RUNE_FUSION_COST
  produced: number; // 항상 1
};

export type FusionError =
  | "max_grade" // 5등급은 합성 불가
  | "insufficient"; // 보유량 < 3

export function planRuneFusion(
  id: RuneId,
  fromGrade: RuneGrade,
  have: number,
): FusionPlan | FusionError {
  if (fromGrade >= 5) return "max_grade";
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
