// 자동 사냥(타이머형 원정) 공통 상수 + 효율 후처리.
//
// 라이브 "사냥 시작"(BattleView 화면 안 자동 전투, huntingActive)과는 별개다.
// 이쪽은 "6시간 동안 사냥 보냄 → 6시간 뒤 수령" 패턴 — 서버가 시작 시각을 소유하고,
// 수령 시 simMs = min(경과, 6시간) 만큼 simulateOfflineHunt 를 한 번에 돌려 결과를 적용한다.
//
// 효율 90%: 직접 안 싸운 데 대한 세금. 받는 EXP·골드·전리품만 줄이고, 잡은 마릿수
// (killsByName / wins / battles) 는 그대로 — 퀘스트 처치 진행·도감은 100% 반영된다.
// 단, 전투 수는 AUTO_HUNT_MAX_BATTLES 로 cap — 원샷 캐릭터가 한 수령에 수천 킬 쏟는 것 방지.

import type { OfflineSimResult } from "./offlineSim";

/** 한 번 보내면 시뮬되는 사냥 시간. */
export const AUTO_HUNT_DURATION_MS = 6 * 60 * 60 * 1000;
/**
 * 한 번의 위탁에서 진행할 전투 수 상한. 시간 cap 만으로는 원샷 캐릭터가 전투당 최소
 * 쿨다운(600ms)으로 6시간이면 ~36000전투를 돌 수 있어 "전투당 ~1.2초" 기준으로 다시 cap
 * (6시간 → 18000). 보통 캐릭터(전투당 ≳1.5초)는 시간 cap 에 먼저 걸려 영향 없음.
 */
export const AUTO_HUNT_MAX_BATTLES = Math.floor(AUTO_HUNT_DURATION_MS / 1200);
/** 위탁 사냥 효율 — EXP·골드·전리품에 곱해진다. */
export const AUTO_HUNT_EFFICIENCY = 0.9;
/** 보낸 지 이 시간 미만이면 "지금 수령"을 거부 — 실수로 슬롯 날리는 것 방지. */
export const AUTO_HUNT_MIN_COLLECT_MS = 10_000;

/**
 * 위탁 사냥 중 HP 0 — 사이클을 그냥 끝내지 않고 부활 시퀀스를 발동한다.
 *   1) 20분의 "쉬는 시간" 을 elapsed 에 더해 사이클 시간을 까먹음 (보상 0인 무위 구간).
 *   2) HP 를 maxHp 까지 회복.
 *   3) 작은 회복약(potion_heal_s) 을 15까지 충전 (이미 더 있으면 그대로).
 *   4) 같은 region 에서 전투 재개.
 * sim 시계는 cap 까지만 흐르므로 부활 횟수도 자연히 (cap / 20분) 으로 제한된다.
 */
export const AUTO_HUNT_REVIVE_DELAY_MS = 20 * 60 * 1000;
/** 부활 시 작은 회복약 충전 목표치 — 보유량이 이보다 적을 때만 차이만큼 지급. */
export const AUTO_HUNT_REVIVE_POTION_REFILL = 15;

/**
 * 서버측 sim 실행 wall-clock 예산(ms). 단일 EC2 의 이벤트 루프를 한 collect 요청이
 * 수 초 동안 점유하는 사고를 막는 안전망. 보통 사이클은 1~2초 안에 끝나므로 일반 유저는
 * 영향 없고, 극단 케이스(낮은 레벨 × 높은 HP 적 × 최대 전투 수)에서만 잘리며 그 시점까지
 * 결과가 정상 반환된다. 6시간 확장으로 비례 상향(2s → 12s) — collect sim 은 이미 tx 밖에서
 * 돌아 풀/락 점유는 없고, 이벤트 루프 점유 시간만 늘어난다.
 */
export const AUTO_HUNT_SIM_BUDGET_MS = 12_000;

/** reload 직전 결과를 박아두는 sessionStorage 키. 마운트 직후 핸들러가 읽고 삭제. */
export const AUTO_HUNT_RESULT_KEY = "auto-hunt-result.v1";

/**
 * sim 결과에 효율(0~1)을 적용한다.
 * - expGained / goldGained → floor(×eff). (큰 수라 floor 손실 무의미.)
 * - 전리품(materials unit / equip / recipe) → 각 unit 을 eff 확률로 keep.
 *   floor(count×eff) 로 깎으면 단일 드롭이 항상 사라지므로(1×0.7=0.7→0) per-unit RNG.
 * - killsByName / wins / battles / potionsConsumed / finalPlayerHp / died / simulatedMs 는 그대로.
 * - revives / potionsGranted (부활 보급) 는 효율 적용 대상 아님 — 안전망이지 보상이 아님.
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
