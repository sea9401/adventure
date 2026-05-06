/**
 * 탐험 조기 종료 부분 보상 시뮬 (docs/18 §11 검증)
 *
 * 검증 목표:
 *   1. progress=1.0 시 부분 결과 = 풀 결과 (flooring 외 일치)
 *   2. progress=0.5 시 부분 결과 ≈ 풀 결과의 50%
 *   3. cancel은 출발 시점 길이의 효율을 그대로 유지
 *      → 7200초@1800초 cancel 의 보상은 fresh 1800초의 (0.75/0.88)배 ≈ 0.852배
 *
 * 사용: npx tsx scripts/cancel-partial-sim.ts
 *
 * 주의: 본 sim은 store.ts cancelDispatch 로직을 재구현해 순수 함수로
 * 테스트한다. store 의 실제 코드와 일치 여부는 별도 코드 리뷰로 검증.
 */

import { resolveDispatch } from "../src/lib/game/logic";
import {
  DISPATCH_REWARD_MULT,
  REGIONS,
  TEST_REWARD_MULT,
  TREASURE_ROLL_PERIOD_SEC,
} from "../src/lib/game/data";
import type {
  Character,
  DispatchResult,
  Guild,
  Materials,
  MaterialKind,
  Region,
} from "../src/lib/game/types";

const RUNS = 2000;
const guild: Guild = { reputation: 0 };

const character: Character = {
  name: "테스트",
  level: 100,
  exp: 0,
  skillExp: 0,
  currentClass: "warrior",
  currentHp: 99999,
};
const innLv = 10;

// store.ts cancelDispatch 의 부분 결과 계산 로직을 그대로 옮긴 순수 함수.
function computePartial(
  result: DispatchResult,
  region: Region,
  elapsedSec: number,
  playbackSec: number,
  guildReputation: number,
): { gold: number; iron: number; exp: number; materials: Materials; hits: number } {
  const progress = Math.min(1, Math.max(0, playbackSec > 0 ? elapsedSec / playbackSec : 0));
  const elapsedRolls = Math.floor(elapsedSec / TREASURE_ROLL_PERIOD_SEC);
  const activeRolls = result.treasureRolls.slice(0, elapsedRolls);
  let hits = 0;
  if (region.treasure) {
    for (const r of activeRolls) {
      if (r < region.treasure.chance) hits++;
    }
  }
  const tGoldRaw = hits * (region.treasure?.gold ?? 0);
  const tIronRaw = hits * (region.treasure?.iron ?? 0);
  const tMatsRaw: Materials = {};
  if (hits > 0 && region.treasure?.materials) {
    for (const [k, v] of Object.entries(region.treasure.materials)) {
      if (v) tMatsRaw[k as MaterialKind] = v * hits;
    }
  }

  const guildMult = Math.min(1.5, 1 + guildReputation * 0.0005);
  const durationMult = DISPATCH_REWARD_MULT[result.durationSec as 60 | 1800 | 7200] ?? 1.0;
  const finalMult = guildMult * durationMult * TEST_REWARD_MULT;
  const expMult = durationMult * TEST_REWARD_MULT;

  const gold = Math.floor((result.killsGoldRaw * progress + tGoldRaw) * finalMult);
  const iron = Math.floor((result.killsIronRaw * progress + tIronRaw) * finalMult);
  const exp = Math.floor(result.killsExpRaw * progress * expMult);

  const materials: Materials = {};
  for (const [k, v] of Object.entries(result.killsMaterialsRaw)) {
    if (v) {
      const scaled = Math.floor(v * progress);
      if (scaled > 0) materials[k as MaterialKind] = scaled;
    }
  }
  for (const [k, v] of Object.entries(tMatsRaw)) {
    if (v) materials[k as MaterialKind] = (materials[k as MaterialKind] ?? 0) + v;
  }

  return { gold, iron, exp, materials, hits };
}

// === 검증 1: progress=1 시 부분 결과 = 풀 결과 ===
console.log("# Cancel Partial Reward 시뮬 (RUNS=" + RUNS + ")");
console.log();
console.log("## 1. progress=1.0 → 풀 결과와 일치");
console.log();

const region = REGIONS.find((r) => r.id === "plains")!;
let mismatchProg1 = 0;
const sampleResults: DispatchResult[] = [];

for (let i = 0; i < 100; i++) {
  const r = resolveDispatch(character, region, guild, 7200, undefined, innLv);
  sampleResults.push(r);
  const p = computePartial(r, region, 7200, 7200, 0);
  // 부분 결과 progress=1은 result.gained와 거의 같아야 함 (정수 floor 차이만)
  const goldDiff = Math.abs(p.gold - (r.gained.gold ?? 0));
  const ironDiff = Math.abs(p.iron - (r.gained.iron ?? 0));
  if (goldDiff > 1 || ironDiff > 1) {
    mismatchProg1++;
  }
}
console.log(`샘플 100회 중 progress=1 결과가 풀 결과와 일치(±1 floor): ${100 - mismatchProg1}/100`);
console.log(mismatchProg1 === 0 ? "→ PASS ✓" : "→ FAIL ✗");

// === 검증 2: progress=0.5 ≈ 풀의 50% ===
console.log();
console.log("## 2. progress=0.5 → 풀 결과의 약 50%");
console.log();
console.log(
  "| 길이 | 풀 골드 평균 | 50%(이론) | 50% cancel 평균 | 오차 | 풀 EXP | 50% EXP cancel | 오차 |",
);
console.log("|---|---:|---:|---:|---:|---:|---:|---:|");

for (const dur of [1800, 7200] as const) {
  let fullGold = 0,
    halfGold = 0,
    fullExp = 0,
    halfExp = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = resolveDispatch(character, region, guild, dur, undefined, innLv);
    fullGold += r.gained.gold ?? 0;
    fullExp += r.exp;
    const p = computePartial(r, region, dur / 2, dur, 0);
    halfGold += p.gold;
    halfExp += p.exp;
  }
  const fgAvg = fullGold / RUNS;
  const hgAvg = halfGold / RUNS;
  const halfExpected = fgAvg / 2;
  const goldErr = halfExpected > 0 ? ((hgAvg - halfExpected) / halfExpected) * 100 : 0;

  const feAvg = fullExp / RUNS;
  const heAvg = halfExp / RUNS;
  const expExpected = feAvg / 2;
  const expErr = expExpected > 0 ? ((heAvg - expExpected) / expExpected) * 100 : 0;

  console.log(
    `| ${dur}초 | ${fgAvg.toFixed(0)} | ${halfExpected.toFixed(0)} | ${hgAvg.toFixed(0)} | ${goldErr >= 0 ? "+" : ""}${goldErr.toFixed(1)}% | ${feAvg.toFixed(0)} | ${heAvg.toFixed(0)} | ${expErr >= 0 ? "+" : ""}${expErr.toFixed(1)}% |`,
  );
}

// === 검증 3: 7200@1800 cancel vs fresh 1800 — 효율 곡선 보존 ===
console.log();
console.log("## 3. 7200초 1800초 시점 cancel vs fresh 1800초 — 효율 곡선 보존");
console.log(
  "    (cancel은 7200의 0.75 mult를 유지 → fresh 1800(mult=0.88)의 0.75/0.88 ≈ 0.852배 예상)",
);
console.log();

let cancelGoldSum = 0,
  freshGoldSum = 0,
  cancelExpSum = 0,
  freshExpSum = 0;
for (let i = 0; i < RUNS; i++) {
  const r7200 = resolveDispatch(character, region, guild, 7200, undefined, innLv);
  const partial = computePartial(r7200, region, 1800, 7200, 0);
  cancelGoldSum += partial.gold;
  cancelExpSum += partial.exp;

  const r1800 = resolveDispatch(character, region, guild, 1800, undefined, innLv);
  freshGoldSum += r1800.gained.gold ?? 0;
  freshExpSum += r1800.exp;
}
const cancelGoldAvg = cancelGoldSum / RUNS;
const freshGoldAvg = freshGoldSum / RUNS;
const cancelExpAvg = cancelExpSum / RUNS;
const freshExpAvg = freshExpSum / RUNS;

const goldRatio = freshGoldAvg > 0 ? cancelGoldAvg / freshGoldAvg : 0;
const expRatio = freshExpAvg > 0 ? cancelExpAvg / freshExpAvg : 0;
const expectedRatio = 0.75 / 0.88;

console.log(`| 항목 | 7200@1800 cancel | fresh 1800 | 비율 | 이론(0.75/0.88) | 오차 |`);
console.log(`|---|---:|---:|---:|---:|---:|`);
console.log(
  `| 골드 | ${cancelGoldAvg.toFixed(0)} | ${freshGoldAvg.toFixed(0)} | ${goldRatio.toFixed(3)} | ${expectedRatio.toFixed(3)} | ${(((goldRatio - expectedRatio) / expectedRatio) * 100).toFixed(1)}% |`,
);
console.log(
  `| EXP | ${cancelExpAvg.toFixed(0)} | ${freshExpAvg.toFixed(0)} | ${expRatio.toFixed(3)} | ${expectedRatio.toFixed(3)} | ${(((expRatio - expectedRatio) / expectedRatio) * 100).toFixed(1)}% |`,
);

console.log();
const goldOK = Math.abs(goldRatio - expectedRatio) / expectedRatio < 0.05;
const expOK = Math.abs(expRatio - expectedRatio) / expectedRatio < 0.05;
console.log(`검증 ${goldOK && expOK ? "PASS ✓" : "FAIL ✗"} — cancel 비율이 0.75/0.88 ±5% 이내`);
