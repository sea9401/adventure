// 성장 페이스 시뮬레이션 — 자동 사냥을 N시간 연속 돌렸을 때 전투/EXP/레벨 진척.
// 켜두고 자기 의심 임계값 (시간당 전투 수) 검증과 피로도 단계 결정용 데이터.
//
// 실행: npm test -- growthSim
// 테스트가 console.log 로 표를 찍는다.

import { describe, it } from "vitest";
import { OFFLINE_SIM_MAX_MS, simulateOfflineHunt } from "./offlineSim";
import { applyExpGain, requiredExpToNext } from "@/lib/leveling";
import { WORLD_MAP } from "../data/world";
import { maxHpForLevel } from "../character/defaults";
import { POTIONS } from "../data/potions";
import type { PlayerCombat } from "./engine";

// 레벨 N 표준 빌드 — stat 균등 분배, 권장 장비. 실제 평균 유저를 가깝게 모사.
function buildPlayer(level: number): PlayerCombat {
  // 1pt/level → (level-1) 분배. 균등 round-robin (str/vit/dex/spd/luk).
  const pts = Math.max(0, level - 1);
  const dist = [0, 0, 0, 0, 0]; // str dex vit spd luk
  for (let i = 0; i < pts; i += 1) dist[i % 5] += 1;
  const [str, dex, vit, spd, luk] = [
    3 + dist[0],
    3 + dist[1],
    3 + dist[2],
    3 + dist[3],
    3 + dist[4],
  ];

  // 레벨별 권장 무기 atk (물 흐르듯 자연스러운 수급 가정)
  let weaponAtk = 0;
  let armorDef = 0;
  if (level >= 3) weaponAtk = 2;   // 야구 방망이
  if (level >= 5) weaponAtk = 4;   // 산적의 단검
  if (level >= 8) weaponAtk = 5;   // 수정 단검
  if (level >= 12) weaponAtk = 7;  // 골렘의 망치 / 마정석 검
  if (level >= 5) armorDef = 3;    // 물컹물컹
  if (level >= 10) armorDef = 2;   // 비단 로브 (luk +4 추가지만 무시)
  if (level >= 14) armorDef = 7;   // 골렘갑주

  const def = vit + armorDef;
  const atk =
    str +
    Math.floor(dex / 5) +
    Math.floor(def / 5) +
    Math.floor(luk / 5) +
    Math.floor(spd / 5) +
    weaponAtk;
  const maxHp = maxHpForLevel(level) + vit * 2;
  const evasionPct = dex * 0.5;
  const extraAttackChancePct = Math.min(100, spd * 2.5);
  const critChancePct = luk * 0.5;
  const powerAttackBonus = str >= 10 ? 2 : 0;
  const crushDefReduction = str >= 20 ? 3 : 0;
  const extraAttackEveryNTurns = spd >= 15 ? 5 : 0;
  const vanguardFirstTurnBonus = spd >= 30 ? 1 : 0;

  return {
    hp: maxHp,
    maxHp,
    atk,
    def,
    spd,
    evasionPct,
    attackCount: 1,
    extraAttackChancePct,
    critChancePct,
    powerAttackBonus,
    crushDefReduction,
    extraAttackEveryNTurns,
    vanguardFirstTurnBonus,
  };
}

const TURN = 500; // PLAYER_TURN_INTERVAL_MS — 실시간 자동전투와 동일

// 연속 플레이 시뮬 — N시간을 30분 단위로 쪼개 simulateOfflineHunt 반복 호출.
// 각 chunk 사이에 hp 풀회복 (마을 회귀 모사). 포션은 무한 가정 (헤비 플레이어 best case).
function simulateContinuousPlay(opts: {
  startLevel: number;
  regionId: string;
  hours: number;
  seed?: number;
}) {
  const region = WORLD_MAP.regions.find((r) => r.id === opts.regionId);
  if (!region) throw new Error(`region not found: ${opts.regionId}`);
  let level = opts.startLevel;
  let exp = 0;
  let totalBattles = 0;
  let totalWins = 0;
  let totalExpGained = 0;
  let totalDeaths = 0;
  let elapsedMs = 0;
  const totalMs = opts.hours * 60 * 60 * 1000;

  // 결정적 시드 — 같은 세팅에서 같은 결과.
  let rngState = opts.seed ?? 0xdeadbeef;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };

  // 무한 포션 (HP 60% 미만 시 작은 회복약). 헤비 유저의 베스트 케이스.
  const potions = { potion_heal_s: 99999 };

  while (elapsedMs < totalMs) {
    const chunkMs = Math.min(OFFLINE_SIM_MAX_MS, totalMs - elapsedMs);
    const player = buildPlayer(level);
    const result = simulateOfflineHunt({
      player,
      playerName: "Sim",
      region,
      playerLevel: level,
      playerExp: exp,
      potions,
      turnIntervalMs: TURN,
      awayMs: chunkMs,
      pickAction: (state) => {
        // 간단 자동 — HP 60% 미만이면 회복약, 아니면 공격
        if (state.playerHp / state.playerMaxHp < 0.6) {
          const p = POTIONS["potion_heal_s"];
          if (p) return { kind: "use_potion", potionId: "potion_heal_s", potion: p };
        }
        return { kind: "attack" };
      },
      luk: 3,
      knowsRecipe: () => true, // 제작서 다 안다고 가정 (학습 노이즈 제거)
      rng,
    });

    elapsedMs += chunkMs;
    totalBattles += result.battles;
    totalWins += result.wins;
    totalExpGained += result.expGained;
    if (result.died) totalDeaths += 1;

    // 레벨/EXP 갱신
    const after = applyExpGain(level, exp, result.expGained);
    level = after.level;
    exp = after.exp;
  }

  return {
    hours: opts.hours,
    region: region.name,
    startLevel: opts.startLevel,
    finalLevel: level,
    finalExp: exp,
    expToNext: requiredExpToNext(level) ?? 0,
    totalBattles,
    totalWins,
    totalExpGained,
    totalDeaths,
    battlesPerHour: totalBattles / opts.hours,
    expPerHour: totalExpGained / opts.hours,
  };
}

// 2.5% 의 random walk 영향 줄이려고 N seed 평균.
function avgOfRuns(
  runs: number,
  fn: (seed: number) => ReturnType<typeof simulateContinuousPlay>,
) {
  const results = Array.from({ length: runs }, (_, i) => fn(i * 17 + 1));
  const sum = (k: keyof ReturnType<typeof simulateContinuousPlay>) =>
    results.reduce((a, r) => a + (r[k] as number), 0);
  return {
    finalLevel: sum("finalLevel") / runs,
    totalBattles: Math.round(sum("totalBattles") / runs),
    totalExpGained: Math.round(sum("totalExpGained") / runs),
    totalDeaths: sum("totalDeaths") / runs,
    battlesPerHour: sum("battlesPerHour") / runs,
    expPerHour: sum("expPerHour") / runs,
  };
}

describe("성장 페이스 시뮬레이션", () => {
  it("자동 사냥 1시간 — 레벨대별 전투/EXP 페이스", () => {
    const SCENARIOS = [
      { name: "신규 Lv 1", startLevel: 1, region: "plains" },
      { name: "초반 Lv 5", startLevel: 5, region: "plains" },
      { name: "중반 Lv 8", startLevel: 8, region: "cave" },
      { name: "중반 Lv 10", startLevel: 10, region: "forest" },
      { name: "후반 Lv 15", startLevel: 15, region: "ruins" },
      { name: "엔드 Lv 20", startLevel: 20, region: "ruins" },
    ];

    console.log("\n=== 1시간 자동 사냥 — 5회 평균 ===");
    console.log(
      "시나리오               | 시작Lv | 종료Lv | 전투수 | 전투/시간 | EXP    | EXP/시간",
    );
    console.log("-".repeat(85));
    for (const s of SCENARIOS) {
      const avg = avgOfRuns(5, (seed) =>
        simulateContinuousPlay({
          startLevel: s.startLevel,
          regionId: s.region,
          hours: 1,
          seed,
        }),
      );
      console.log(
        [
          s.name.padEnd(22),
          String(s.startLevel).padStart(6),
          avg.finalLevel.toFixed(1).padStart(6),
          String(avg.totalBattles).padStart(6),
          avg.battlesPerHour.toFixed(1).padStart(9),
          String(avg.totalExpGained).padStart(6),
          avg.expPerHour.toFixed(1).padStart(8),
        ].join(" | "),
      );
    }
  });

  it("플레이 시간대별 — Lv 5에서 시작, 다양한 일일 플레이 시간", () => {
    console.log("\n=== Lv 5에서 시작 — 일일 플레이시간별 진척 (3회 평균, 평야) ===");
    console.log("일일 플레이 | 종료Lv | 전투수  | 전투/시간 | EXP/시간");
    console.log("-".repeat(70));
    for (const hours of [1, 2, 4, 8, 12, 24]) {
      const avg = avgOfRuns(3, (seed) =>
        simulateContinuousPlay({
          startLevel: 5,
          regionId: "plains",
          hours,
          seed,
        }),
      );
      console.log(
        [
          `${hours}시간`.padStart(10),
          avg.finalLevel.toFixed(1).padStart(6),
          String(avg.totalBattles).padStart(7),
          avg.battlesPerHour.toFixed(1).padStart(9),
          avg.expPerHour.toFixed(1).padStart(8),
        ].join(" | "),
      );
    }
  });

  it("Lv 30 도달까지 — 일일 플레이 시간별 며칠? (지역 자동 갱신)", () => {
    console.log("\n=== Lv 1 → Lv 30 도달까지 일수 추정 (지역 레벨 따라 자동 진행) ===");
    console.log("일일 플레이 | 도달 일수 | 누적 전투 | 일평균 전투");
    console.log("-".repeat(60));

    // 레벨대별 권장 지역 (recommendedLevel 기반).
    function regionFor(level: number): string {
      if (level >= 9) return "ruins";
      if (level >= 7) return "lake";
      if (level >= 5) return "forest";
      if (level >= 3) return "cave";
      return "plains";
    }

    function simUntilLv30(hoursPerDay: number, seed: number) {
      let level = 1;
      let exp = 0;
      let totalBattles = 0;
      let days = 0;
      const MAX_DAYS = 365 * 5; // 안전장치

      while (level < 30 && days < MAX_DAYS) {
        const r = simulateContinuousPlay({
          startLevel: level,
          regionId: regionFor(level),
          hours: hoursPerDay,
          seed: seed + days,
        });
        // simulateContinuousPlay 은 매번 startLevel 부터 hp/exp 새로 — 실제 진행은
        // applyExpGain 으로 이어붙여야. 하지만 함수 내부에서 누적 EXP 도 처리하니
        // 결과의 finalLevel/finalExp 이 그날 끝의 상태.
        // 다만 startLevel 0 부터 다시 시작이라 EXP 누적이 끊긴다 — 보정.
        const after = applyExpGain(level, exp, r.totalExpGained);
        level = after.level;
        exp = after.exp;
        totalBattles += r.totalBattles;
        days += 1;
      }

      return { days, totalBattles, finalLevel: level };
    }

    for (const hoursPerDay of [1, 2, 4, 6, 8, 12, 16, 24]) {
      const runs = [0, 17, 34].map((s) => simUntilLv30(hoursPerDay, s));
      const avgDays = runs.reduce((a, r) => a + r.days, 0) / runs.length;
      const avgBattles = Math.round(
        runs.reduce((a, r) => a + r.totalBattles, 0) / runs.length,
      );
      console.log(
        [
          `${hoursPerDay}시간`.padStart(10),
          avgDays.toFixed(1).padStart(9),
          String(avgBattles).padStart(9),
          (avgBattles / Math.max(1, avgDays)).toFixed(0).padStart(11),
        ].join(" | "),
      );
    }
  });
});
