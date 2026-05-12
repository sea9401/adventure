// 운향 라인 (highland / canyon) 난이도·진척 시뮬.
// growthSim.test.ts 의 buildPlayer/simulateContinuousPlay 패턴 그대로 — 결과만 console 출력.
// 실행: npm test -- unhyangSim
//
// 검증 목표:
// 1) Lv 18~22 표준 빌드 vs highland/canyon 잡몹 — 전투수·EXP·사망률
// 2) 기존 Lv 9~14 유저가 운향까지 가는 동선의 시간/전투 부담

import { describe, it } from "vitest";
import { OFFLINE_SIM_MAX_MS, simulateOfflineHunt } from "./offlineSim";
import { applyExpGain, requiredExpToNext } from "@/lib/leveling";
import { WORLD_MAP } from "../data/world";
import { maxHpForLevel } from "../character/defaults";
import { POTIONS } from "../data/potions";
import { MONSTERS } from "../data/monsters";
import type { PlayerCombat } from "./engine";

// 잡몹 stat 임시 조정 — fn 실행 전후로 백업·복원. 너프 강도 비교용.
function withMonsterMod(
  names: string[],
  mod: { atkDelta?: number; hpScale?: number },
  fn: () => void,
) {
  const backups = names.map((n) => ({ ...MONSTERS[n] }));
  for (const n of names) {
    if (mod.atkDelta) MONSTERS[n].atk = MONSTERS[n].atk + mod.atkDelta;
    if (mod.hpScale) MONSTERS[n].hp = Math.round(MONSTERS[n].hp * mod.hpScale);
  }
  try {
    fn();
  } finally {
    for (let i = 0; i < names.length; i += 1) Object.assign(MONSTERS[names[i]], backups[i]);
  }
}

// 빌드 키트 — 가정한 장비 셋:
//  naked : 장비 없음 (스탯 분배만)
//  partial: 수정 단검(Lv8+) / 산적의 단검(Lv5+) / 야구 방망이(Lv3+) + 물컹물컹(Lv5+)
//           광맥 보스 못 깬 일반 유저
//  full  : 마정석 검(Lv12+) + 골렘갑주(Lv14+) + 마정석 팔찌(Lv12+)
//           광맥 보스 클리어한 표준 빌드
type Kit = "naked" | "partial" | "full";

// 균등 분배 / plan §9.1 의 str·vit 위주 (대장 빌드).
type StatDist = "even" | "warrior";

function buildPlayer(
  level: number,
  kit: Kit = "full",
  dist: StatDist = "even",
): PlayerCombat {
  const pts = Math.max(0, level - 1);

  // 베이스 분배.
  let allocated: [number, number, number, number, number]; // str dex vit spd luk
  if (dist === "warrior") {
    // plan §9.1 패턴 — str:vit:dex:luk:spd ≈ 9:7:3:0:2 (Lv 22 기준 21pt)
    // 비율 0.43 / 0.33 / 0.14 / 0.0 / 0.10
    const s = Math.round(pts * 0.43);
    const v = Math.round(pts * 0.33);
    const d = Math.round(pts * 0.14);
    const l = Math.max(0, pts - s - v - d);
    allocated = [s, d, v, 0, l];
  } else {
    const r = [0, 0, 0, 0, 0];
    for (let i = 0; i < pts; i += 1) r[i % 5] += 1;
    allocated = [r[0], r[1], r[2], r[3], r[4]];
  }
  let [str, dex, vit, spd, luk] = [
    3 + allocated[0],
    3 + allocated[1],
    3 + allocated[2],
    3 + allocated[3],
    3 + allocated[4],
  ];

  // 장비 base atk/def + bonus 스탯.
  let weaponAtk = 0;
  let armorDef = 0;
  let bonusAtk = 0;

  if (kit === "full") {
    if (level >= 12) {
      // 마정석 검: atk +7, str +3
      weaponAtk = 7;
      str += 3;
    } else if (level >= 8) {
      // 수정 단검: atk +5, dex +1
      weaponAtk = 5;
      dex += 1;
    } else if (level >= 5) {
      // 산적의 단검: atk +4, dex +2
      weaponAtk = 4;
      dex += 2;
    } else if (level >= 3) {
      // 야구 방망이: atk +2
      weaponAtk = 2;
    }

    if (level >= 14) {
      // 골렘갑주: def +7, atk -1, spd -3, luk -1
      armorDef = 7;
      bonusAtk -= 1;
      spd -= 3;
      luk -= 1;
    } else if (level >= 5) {
      armorDef = 3; // 물컹물컹
    }

    if (level >= 12) {
      // 마정석 팔찌: vit +3, spd +2
      vit += 3;
      spd += 2;
    }
  } else if (kit === "partial") {
    if (level >= 8) {
      weaponAtk = 5;
      dex += 1;
    } else if (level >= 5) {
      weaponAtk = 4;
      dex += 2;
    } else if (level >= 3) {
      weaponAtk = 2;
    }
    if (level >= 5) armorDef = 3; // 물컹물컹만
  }

  // 음수 방지 (low level + 골렘갑주 페널티 대비).
  spd = Math.max(0, spd);
  luk = Math.max(0, luk);

  const def = vit + armorDef;
  const atk = Math.max(
    1,
    str +
      Math.floor(dex / 5) +
      Math.floor(def / 5) +
      Math.floor(luk / 5) +
      Math.floor(spd / 5) +
      weaponAtk +
      bonusAtk,
  );
  const maxHp = maxHpForLevel(level) + vit * 2;
  const evasionPct = dex * 0.5;
  const extraAttackChancePct = Math.min(100, spd * 2.5);
  const critChancePct = luk * 0.5;
  const powerAttackBonus = str >= 10 ? 2 : 0;
  const crushDefReduction = str >= 20 ? Math.floor(str * 0.5) : 0;
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

const TURN = 500;

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

  let rngState = opts.seed ?? 0xdeadbeef;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };

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
        if (state.playerHp / state.playerMaxHp < 0.6) {
          const p = POTIONS["potion_heal_s"];
          if (p) return { kind: "use_potion", potionId: "potion_heal_s", potion: p };
        }
        return { kind: "attack" };
      },
      luk: 3,
      knowsRecipe: () => true,
      rng,
    });

    elapsedMs += chunkMs;
    totalBattles += result.battles;
    totalWins += result.wins;
    totalExpGained += result.expGained;
    if (result.died) totalDeaths += 1;

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

// 벽 체감 — 포션 한도 10개 + 마을 회복 없음 (한 사이클 1시간).
// 사망 / 포션 소비를 측정해 "처음 진입했을 때 막히는가" 판정.
function simWallFeel(opts: {
  level: number;
  regionId: string;
  potionStock: number;
  seed: number;
  kit?: Kit;
  dist?: StatDist;
}) {
  const region = WORLD_MAP.regions.find((r) => r.id === opts.regionId);
  if (!region) throw new Error(`region not found: ${opts.regionId}`);

  let rngState = opts.seed;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };

  const player = buildPlayer(opts.level, opts.kit ?? "full", opts.dist ?? "even");
  const result = simulateOfflineHunt({
    player,
    playerName: "Sim",
    region,
    playerLevel: opts.level,
    playerExp: 0,
    potions: { potion_heal_s: opts.potionStock },
    turnIntervalMs: TURN,
    awayMs: OFFLINE_SIM_MAX_MS,
    pickAction: (state) => {
      if (state.playerHp / state.playerMaxHp < 0.6) {
        const p = POTIONS["potion_heal_s"];
        if (p) return { kind: "use_potion", potionId: "potion_heal_s", potion: p };
      }
      return { kind: "attack" };
    },
    luk: 3,
    knowsRecipe: () => true,
    rng,
  });

  return {
    battles: result.battles,
    wins: result.wins,
    died: result.died,
    finalHp: result.finalPlayerHp,
    maxHp: player.maxHp,
    potionsUsed: result.potionsConsumed.potion_heal_s ?? 0,
    simMin: result.simulatedMs / 60000,
  };
}

const CANYON_MOBS = ["절벽 늑대", "돌풍 정령", "늑대 무리장"];

function runMod(label: string, mod: { atkDelta?: number; hpScale?: number }) {
  const builds: Array<{ name: string; level: number; kit: Kit; dist: StatDist }> = [
    { name: "Lv20 full·even   ", level: 20, kit: "full", dist: "even" },
    { name: "Lv20 full·warrior", level: 20, kit: "full", dist: "warrior" },
    { name: "Lv22 full·warrior", level: 22, kit: "full", dist: "warrior" },
  ];
  withMonsterMod(CANYON_MOBS, mod, () => {
    for (const b of builds) {
      const runs = Array.from({ length: 10 }, (_, i) =>
        simWallFeel({
          level: b.level,
          regionId: "canyon",
          potionStock: 10,
          seed: i * 31 + 1,
          kit: b.kit,
          dist: b.dist,
        }),
      );
      const avgBattles = runs.reduce((a, r) => a + r.battles, 0) / runs.length;
      console.log(
        [
          label.padEnd(28),
          b.name.padEnd(18),
          avgBattles.toFixed(1).padStart(6) + " 전투",
        ].join(" | "),
      );
    }
  });
}

describe("운향 라인 시뮬", () => {
  it("벽 체감 — 포션 10개로 1시간 사냥 (10 시드, 빌드별)", () => {
    type Scenario = {
      name: string;
      level: number;
      region: string;
      kit: Kit;
      dist: StatDist;
    };
    const SCENARIOS: Scenario[] = [
      // highland 진입 — Lv 18 가정
      { name: "Lv18 highland · partial · even", level: 18, region: "highland", kit: "partial", dist: "even" },
      { name: "Lv18 highland · full    · even", level: 18, region: "highland", kit: "full",    dist: "even" },
      { name: "Lv18 highland · full    · warrior", level: 18, region: "highland", kit: "full", dist: "warrior" },
      { name: "Lv20 highland · full    · warrior", level: 20, region: "highland", kit: "full", dist: "warrior" },
      // canyon 진입 — Lv 20 가정
      { name: "Lv20 canyon  · partial · even", level: 20, region: "canyon", kit: "partial", dist: "even" },
      { name: "Lv20 canyon  · full    · even", level: 20, region: "canyon", kit: "full",    dist: "even" },
      { name: "Lv20 canyon  · full    · warrior", level: 20, region: "canyon", kit: "full", dist: "warrior" },
      { name: "Lv22 canyon  · full    · warrior", level: 22, region: "canyon", kit: "full", dist: "warrior" },
    ];

    console.log("\n=== 포션 10개 + 1시간 cap, 10시드 평균 ===");
    console.log("(kit=partial: 마정석 셋 미보유 / full: 마정석 검+골렘갑주+팔찌)");
    console.log("(dist=even: 균등 분배 / warrior: str·vit 위주 plan §9 빌드)");
    console.log(
      "\n시나리오                                | ATK | DEF | maxHp | 평균전투 | 사망률 | 포션사용 | 끝HP%",
    );
    console.log("-".repeat(110));
    for (const s of SCENARIOS) {
      const proto = buildPlayer(s.level, s.kit, s.dist);
      const runs = Array.from({ length: 10 }, (_, i) =>
        simWallFeel({
          level: s.level,
          regionId: s.region,
          potionStock: 10,
          seed: i * 31 + 1,
          kit: s.kit,
          dist: s.dist,
        }),
      );
      const avgBattles = runs.reduce((a, r) => a + r.battles, 0) / runs.length;
      const deathRate = runs.filter((r) => r.died).length / runs.length;
      const avgPotions =
        runs.reduce((a, r) => a + r.potionsUsed, 0) / runs.length;
      const avgHpPct =
        runs.reduce(
          (a, r) => a + (r.died ? 0 : r.finalHp / r.maxHp),
          0,
        ) / runs.length;
      console.log(
        [
          s.name.padEnd(38),
          String(proto.atk).padStart(3),
          String(proto.def).padStart(3),
          String(proto.maxHp).padStart(5),
          avgBattles.toFixed(1).padStart(8),
          (deathRate * 100).toFixed(0).padStart(5) + "%",
          avgPotions.toFixed(1).padStart(8),
          (avgHpPct * 100).toFixed(0).padStart(6) + "%",
        ].join(" | "),
      );
    }
  });

  it("canyon 너프 강도 비교 — 평균 잡은 전투수", () => {
    console.log("\n=== canyon 잡몹 너프 강도별 — 포션 10개로 잡는 전투수 (10시드 평균) ===");
    console.log("적용 너프                    | 빌드               | 평균전투");
    console.log("-".repeat(75));
    runMod("baseline (현재)             ", {});
    runMod("atk -2                      ", { atkDelta: -2 });
    runMod("atk -3                      ", { atkDelta: -3 });
    runMod("atk -3 + hp ×0.85           ", { atkDelta: -3, hpScale: 0.85 });
    runMod("atk -4 + hp ×0.85           ", { atkDelta: -4, hpScale: 0.85 });
    runMod("atk -3 + hp ×0.75           ", { atkDelta: -3, hpScale: 0.75 });
    runMod("atk -5 + hp ×0.75           ", { atkDelta: -5, hpScale: 0.75 });
  });

  it("highland / canyon 1시간 전투 페이스 (5회 평균)", () => {
    const SCENARIOS = [
      { name: "Lv 14 (under) → ruins", startLevel: 14, region: "ruins" },
      { name: "Lv 18 → ruins", startLevel: 18, region: "ruins" },
      { name: "Lv 18 → highland", startLevel: 18, region: "highland" },
      { name: "Lv 20 → highland", startLevel: 20, region: "highland" },
      { name: "Lv 18 (under) → canyon", startLevel: 18, region: "canyon" },
      { name: "Lv 20 → canyon", startLevel: 20, region: "canyon" },
      { name: "Lv 22 → canyon", startLevel: 22, region: "canyon" },
      { name: "Lv 25 (over) → canyon", startLevel: 25, region: "canyon" },
    ];

    console.log("\n=== 운향 라인 1시간 자동 사냥 — 5회 평균 (포션 무한 가정) ===");
    console.log(
      "시나리오                  | 시작Lv | 종료Lv | 전투수 | 전투/시간 | EXP/시간 | 사망(/5회)",
    );
    console.log("-".repeat(105));
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
          s.name.padEnd(25),
          String(s.startLevel).padStart(6),
          avg.finalLevel.toFixed(1).padStart(6),
          String(avg.totalBattles).padStart(6),
          avg.battlesPerHour.toFixed(1).padStart(9),
          avg.expPerHour.toFixed(0).padStart(8),
          avg.totalDeaths.toFixed(1).padStart(11),
        ].join(" | "),
      );
    }
  });

  it("기존 유저 → 운향 도시까지 가는 시간 (regionFor 자동 진행)", () => {
    console.log(
      "\n=== Lv N → Lv 22 도달까지 일수 (highland 잠금 풀린 후 가정, 3회 평균) ===",
    );

    function regionFor(level: number): string {
      if (level >= 20) return "canyon";
      if (level >= 18) return "highland";
      if (level >= 9) return "ruins";
      if (level >= 7) return "lake";
      if (level >= 5) return "forest";
      if (level >= 3) return "cave";
      return "plains";
    }

    function simUntilTarget(opts: {
      startLevel: number;
      target: number;
      hoursPerDay: number;
      seed: number;
    }) {
      let level = opts.startLevel;
      let exp = 0;
      let totalBattles = 0;
      let totalDeaths = 0;
      let days = 0;
      const MAX_DAYS = 365 * 3;

      while (level < opts.target && days < MAX_DAYS) {
        const r = simulateContinuousPlay({
          startLevel: level,
          regionId: regionFor(level),
          hours: opts.hoursPerDay,
          seed: opts.seed + days,
        });
        const after = applyExpGain(level, exp, r.totalExpGained);
        level = after.level;
        exp = after.exp;
        totalBattles += r.totalBattles;
        totalDeaths += r.totalDeaths;
        days += 1;
      }

      return { days, totalBattles, totalDeaths, finalLevel: level };
    }

    const STARTS = [
      { name: "신규 Lv 1", startLevel: 1 },
      { name: "초보 Lv 5", startLevel: 5 },
      { name: "중반 Lv 9 (폐허 진입)", startLevel: 9 },
      { name: "후반 Lv 14", startLevel: 14 },
      { name: "엔드 Lv 18 (highland 진입)", startLevel: 18 },
    ];

    for (const start of STARTS) {
      console.log(`\n[${start.name}] → Lv 22`);
      console.log("일일 플레이 | 도달 일수 | 누적 전투 | 사망/1시간 cap × N | 일평균 전투");
      console.log("-".repeat(75));
      for (const hours of [1, 2, 4, 8]) {
        const runs = [0, 17, 34].map((s) =>
          simUntilTarget({
            startLevel: start.startLevel,
            target: 22,
            hoursPerDay: hours,
            seed: s,
          }),
        );
        const avgDays = runs.reduce((a, r) => a + r.days, 0) / runs.length;
        const avgBattles = Math.round(
          runs.reduce((a, r) => a + r.totalBattles, 0) / runs.length,
        );
        const avgDeaths = (
          runs.reduce((a, r) => a + r.totalDeaths, 0) / runs.length
        ).toFixed(1);
        console.log(
          [
            `${hours}시간`.padStart(10),
            avgDays.toFixed(1).padStart(9),
            String(avgBattles).padStart(9),
            String(avgDeaths).padStart(17),
            (avgBattles / Math.max(1, avgDays)).toFixed(0).padStart(11),
          ].join(" | "),
        );
      }
    }
  });
});
