// 고탑 도전 모드 — 1.5× HP/ATK/DEF 곱 스케일링. SPD 는 곱하지 않는다 (회피 빌드 이중 페널티 방지).
//
// 기존 scaledStats(base, floor, bossMult, modifier) 는 modifier 의 enemyHp/Atk/Def/SpdMult 를
// 마지막에 곱한다 — 도전 모드는 주간 모디파이어 대신 이 CHALLENGE_MODIFIER 를 주입해 동일 경로
// 재사용. 별도 함수 추가 없이 호출처에서 modifier 만 교체하면 된다.

import type { TowerModifier } from "./modifiers";

/**
 * 도전 모드 합의 스탯 곱. modifier 자료형을 재사용해 scaledStats 의 마지막 곱연산 슬롯에
 * 그대로 박힌다. UI 표시에는 쓰지 않는다 — 모디파이어 풀(TOWER_MODIFIER_POOL) 과 별개.
 */
export const TOWER_CHALLENGE_MODIFIER: TowerModifier = {
  id: "none",
  name: "도전 모드",
  description: "도전 모드 — 적 HP/ATK/DEF ×1.5 (SPD 제외).",
  enemyHpMult: 1.5,
  enemyAtkMult: 1.5,
  enemyDefMult: 1.5,
};
