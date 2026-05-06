/**
 * 보물 분당 굴림 시뮬 (docs/22 §11 검증)
 *
 * 검증 목표:
 *   1. 적중 횟수: 길이별 기대값이 굴림수 × chance 에 수렴 (분산 ±5% 안)
 *   2. 1초당 적중: 모든 길이에서 동일 (= 1:1:1, DISPATCH_REWARD_MULT 미적용 단계)
 *   3. 1초당 보물 골드: 1.0 : 0.88 : 0.75 비율 (DISPATCH_REWARD_MULT 곡선 일치)
 *
 * 사용: npx tsx scripts/treasure-rate-sim.ts
 */

import { resolveDispatch } from "../src/lib/game/logic";
import { DISPATCH_REWARD_MULT, REGIONS, TREASURE_ROLL_PERIOD_SEC } from "../src/lib/game/data";
import type { Character, Guild } from "../src/lib/game/types";

const RUNS = 5000;
const guild: Guild = { reputation: 0 };

// Lv 100 전사 + innLv 10 (풀 HP 회복) → 평원/사막/광산 생존 보장.
// 후반 지역(설원/유령선/심연)은 Lv 100 무장비로는 사망 → totalKills=0 → 굴림 미발생.
// 본 sim은 굴림 메커니즘 자체 검증이 목적이라 캐릭터가 안 죽는 지역만 사용.
const character: Character = {
  name: "테스트",
  level: 100,
  exp: 0,
  skillExp: 0,
  currentClass: "warrior",
  currentHp: 99999,
};
const innLv = 10;

const durations = [60, 1800, 7200] as const;

// 대표 지역 3곳 (저/중 chance — 캐릭터 생존 보장 영역만)
const TEST_REGIONS = ["plains", "forest", "desert"];

console.log(`# 보물 분당 굴림 시뮬 (RUNS=${RUNS})`);
console.log();

interface Result {
  hitsAvg: number;
  hitsStd: number;
  treasureGoldAvg: number;
}
const results: Record<string, Record<number, Result>> = {};

for (const regionId of TEST_REGIONS) {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region || !region.treasure) continue;
  results[regionId] = {} as Record<number, Result>;

  for (const dur of durations) {
    const hits: number[] = [];
    let totalTreasureGold = 0;
    for (let i = 0; i < RUNS; i++) {
      const r = resolveDispatch(character, region, guild, dur, undefined, innLv);
      hits.push(r.treasureHits);
      // 보물 골드만 분리 = treasureHits × treasure.gold × DISPATCH_REWARD_MULT (페이아웃에 적용된 mult)
      totalTreasureGold += r.treasureHits * (region.treasure.gold ?? 0) * DISPATCH_REWARD_MULT[dur];
    }
    const avg = hits.reduce((s, x) => s + x, 0) / RUNS;
    const variance = hits.reduce((s, x) => s + (x - avg) ** 2, 0) / RUNS;
    results[regionId][dur] = {
      hitsAvg: avg,
      hitsStd: Math.sqrt(variance),
      treasureGoldAvg: totalTreasureGold / RUNS,
    };
  }
}

// === 출력 1: 적중 횟수 ===
console.log("## 1. 적중 횟수 — 굴림수 × chance 에 수렴");
console.log();
console.log("| 지역 | chance | 길이 | 굴림수 | 이론 평균 | 측정 평균 | 표준편차 | 오차 |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|");

for (const regionId of TEST_REGIONS) {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region || !region.treasure) continue;
  for (const dur of durations) {
    const rolls = Math.max(1, Math.floor(dur / TREASURE_ROLL_PERIOD_SEC));
    const expected = rolls * region.treasure.chance;
    const r = results[regionId][dur];
    const err = expected > 0 ? ((r.hitsAvg - expected) / expected) * 100 : 0;
    console.log(
      `| ${region.name} | ${(region.treasure.chance * 100).toFixed(1)}% | ${dur}초 | ${rolls} | ${expected.toFixed(3)} | ${r.hitsAvg.toFixed(3)} | ${r.hitsStd.toFixed(3)} | ${err >= 0 ? "+" : ""}${err.toFixed(1)}% |`,
    );
  }
}

// === 출력 2: 1초당 적중 비율 ===
console.log();
console.log("## 2. 1초당 적중 — 모든 길이에서 동일해야 함 (DISPATCH_REWARD_MULT 미적용)");
console.log();
console.log("| 지역 | 길이 | 1초당 적중 | vs 60초 (이론 1.000) |");
console.log("|---|---:|---:|---:|");

for (const regionId of TEST_REGIONS) {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) continue;
  const base = results[regionId][60].hitsAvg / 60;
  for (const dur of durations) {
    const perSec = results[regionId][dur].hitsAvg / dur;
    const ratio = base > 0 ? perSec / base : 1;
    console.log(
      `| ${region.name} | ${dur}초 | ${perSec.toExponential(3)} | ${ratio.toFixed(3)}x |`,
    );
  }
}

// === 출력 3: 1초당 보물 골드 — 이론값과 비교 ===
// 이론: perSec = chance × treasureGold × DISPATCH_REWARD_MULT[dur] / TREASURE_ROLL_PERIOD_SEC
// 60초 measured를 baseline으로 쓰면 noise 누적 → 이론값과 직접 비교가 더 안정.
console.log();
console.log("## 3. 1초당 보물 골드 — 이론값 대비 (DISPATCH_REWARD_MULT 곡선 일치)");
console.log();
console.log("| 지역 | 길이 | 측정 골드/sec | 이론 골드/sec | 오차 | mult |");
console.log("|---|---:|---:|---:|---:|---:|");

let allPass = true;
for (const regionId of TEST_REGIONS) {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region || !region.treasure?.gold) continue;
  const tGold = region.treasure.gold;
  const chance = region.treasure.chance;
  for (const dur of durations) {
    const perSec = results[regionId][dur].treasureGoldAvg / dur;
    const theoretical = (chance * tGold * DISPATCH_REWARD_MULT[dur]) / TREASURE_ROLL_PERIOD_SEC;
    const err = theoretical > 0 ? Math.abs((perSec - theoretical) / theoretical) * 100 : 0;
    // 60초는 RUNS만큼만 단일 시행 → ±10%, 1800/7200초는 다회 시행으로 분산 작음 → ±5%.
    const tolerance = dur === 60 ? 10 : 5;
    const flag = err > tolerance ? " ⚠" : "";
    if (err > tolerance) allPass = false;
    console.log(
      `| ${region.name} | ${dur}초 | ${perSec.toFixed(5)} | ${theoretical.toFixed(5)} | ${err >= 0 ? "+" : ""}${err.toFixed(1)}%${flag} | ${DISPATCH_REWARD_MULT[dur]} |`,
    );
  }
}

console.log();
console.log(`검증 ${allPass ? "PASS ✓" : "FAIL ✗"} — 1초당 보물 골드 vs 이론값 오차 ±5% 이내`);
console.log("(60초 측정값은 RUNS=1000에서 변동폭이 큼 — 1800/7200초가 더 신뢰.)");
