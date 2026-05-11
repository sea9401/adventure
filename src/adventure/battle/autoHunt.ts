// 자동 사냥(타이머형 원정) 공통 상수 + 효율 후처리.
//
// 라이브 "사냥 시작"(BattleView 화면 안 자동 전투, huntingActive)과는 별개다.
// 이쪽은 "30분 동안 사냥 보냄 → 30분 뒤 수령" 패턴 — 서버가 시작 시각을 소유하고,
// 수령 시 simMs = min(경과, 30분) 만큼 simulateOfflineHunt 를 한 번에 돌려 결과를 적용한다.
//
// 효율 70%: 직접 안 싸운 데 대한 세금. 받는 EXP·골드·전리품만 줄이고, 잡은 마릿수
// (killsByName / wins / battles) 는 그대로 — 퀘스트 처치 진행·도감은 100% 반영된다.

import type { OfflineSimResult } from "./offlineSim";

/** 한 번 보내면 시뮬되는 사냥 시간. */
export const AUTO_HUNT_DURATION_MS = 30 * 60 * 1000;
/** 위탁 사냥 효율 — EXP·골드·전리품에 곱해진다. */
export const AUTO_HUNT_EFFICIENCY = 0.7;
/** 보낸 지 이 시간 미만이면 "지금 수령"을 거부 — 실수로 슬롯 날리는 것 방지. */
export const AUTO_HUNT_MIN_COLLECT_MS = 10_000;

/** reload 직전 결과를 박아두는 sessionStorage 키. 마운트 직후 핸들러가 읽고 삭제. */
export const AUTO_HUNT_RESULT_KEY = "auto-hunt-result.v1";

/**
 * sim 결과에 효율(0~1)을 적용한다.
 * - expGained / goldGained → floor(×eff). (큰 수라 floor 손실 무의미.)
 * - 전리품(materials unit / equip / recipe) → 각 unit 을 eff 확률로 keep.
 *   floor(count×eff) 로 깎으면 단일 드롭이 항상 사라지므로(1×0.7=0.7→0) per-unit RNG.
 * - killsByName / wins / battles / potionsConsumed / finalPlayerHp / died / simulatedMs 는 그대로.
 *
 * rng 는 sim 과 같은 시드 스트림을 이어받아 호출 — 같은 baseline 으로 재시도해도 동일 결과(replay 안전).
 */
export function applyAutoHuntEfficiency(
  result: OfflineSimResult,
  efficiency: number,
  rng: () => number,
): OfflineSimResult {
  if (efficiency >= 1) return result;

  const materialsGained: Record<string, number> = {};
  for (const [id, count] of Object.entries(result.materialsGained)) {
    let kept = 0;
    for (let i = 0; i < (count ?? 0); i += 1) {
      if (rng() < efficiency) kept += 1;
    }
    if (kept > 0) materialsGained[id] = kept;
  }

  const equipsGained = result.equipsGained.filter(() => rng() < efficiency);
  const recipesLearned = result.recipesLearned.filter(() => rng() < efficiency);

  return {
    ...result,
    expGained: Math.floor(result.expGained * efficiency),
    goldGained: Math.floor(result.goldGained * efficiency),
    materialsGained:
      materialsGained as OfflineSimResult["materialsGained"],
    equipsGained,
    recipesLearned,
  };
}
