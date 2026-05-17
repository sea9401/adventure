// 단순 Elo — K=32 (체스/대중 게임 표준). draw 는 0.5.
//
// 공식:
//   expected = 1 / (1 + 10^((rivalRating - selfRating) / 400))
//   newRating = round(selfRating + K * (actualScore - expected))
//   actualScore: 승=1, 무=0.5, 패=0
//
// 양쪽이 같이 계산되므로 한 쌍의 호출 결과는 zero-sum.

export const ELO_K = 32;
export const ELO_INITIAL = 1000;

export type PvPResult = "win" | "loss" | "draw";

function expectedScore(selfRating: number, rivalRating: number): number {
  return 1 / (1 + Math.pow(10, (rivalRating - selfRating) / 400));
}

function scoreOf(result: PvPResult): number {
  return result === "win" ? 1 : result === "draw" ? 0.5 : 0;
}

// 한 쪽의 새 레이팅. 음수로 떨어지지 않도록 0 floor.
export function computeNewRating(
  selfRating: number,
  rivalRating: number,
  result: PvPResult,
): number {
  const exp = expectedScore(selfRating, rivalRating);
  const delta = ELO_K * (scoreOf(result) - exp);
  return Math.max(0, Math.round(selfRating + delta));
}

// 양쪽 한 번에 — 매치 결과 dispatch 시 호출.
// outcome 은 attacker 기준 — 'a_win'/'d_win'/'draw'.
export function applyEloMatch(
  attackerRating: number,
  defenderRating: number,
  outcome: "a_win" | "d_win" | "draw",
): { attackerAfter: number; defenderAfter: number } {
  const aResult: PvPResult =
    outcome === "a_win" ? "win" : outcome === "d_win" ? "loss" : "draw";
  const dResult: PvPResult =
    outcome === "d_win" ? "win" : outcome === "a_win" ? "loss" : "draw";
  return {
    attackerAfter: computeNewRating(attackerRating, defenderRating, aResult),
    defenderAfter: computeNewRating(defenderRating, attackerRating, dResult),
  };
}
