// VIT/LUK ATK 환산 도입 효과 시뮬 — 일회성 분석.
// 5개 전문화 빌드 × {환산 X / vit·luk 5pt=+1 atk} 조합으로
//   1) 광맥의 수호자 보스 30회 평균 (클리어율, 턴수, 받피)
//   2) 폐허 1시간 자동 사냥 (전투수, EXP/시간, 사망률)
// 을 측정해 1 데미지 함정의 실제 영향과 환산 도입의 효과를 정량화.

import { describe, it } from "vitest";
import { resolveBattle, type PlayerCombat } from "./engine";
import { simulateOfflineHunt, OFFLINE_SIM_MAX_MS } from "./offlineSim";
import { MONSTERS } from "../data/monsters";
import { WORLD_MAP } from "../data/world";
import { POTIONS } from "../data/potions";
import { maxHpForLevel } from "../character/defaults";

type Build = "str" | "dex" | "vit" | "spd" | "luk" | "even";

type ConvMode = "none" | "C" | "D" | "E";
// none: 환산 X (현재)
// C: vit/luk 5pt=+1 atk
// D: vit/luk/spd 5pt=+1 atk
// E: vit 대신 def/5 + luk 5pt=+1 + spd 5pt=+1 (테마: 갑옷 무게가 무기로)

function buildSpecialized(opts: {
  level: number;
  build: Build;
  conv: ConvMode;
}): PlayerCombat {
  const total = Math.max(0, opts.level - 1);
  let str = 3,
    dex = 3,
    vit = 3,
    spd = 3,
    luk = 3;
  if (opts.build === "str") str += total;
  else if (opts.build === "dex") dex += total;
  else if (opts.build === "vit") vit += total;
  else if (opts.build === "spd") spd += total;
  else if (opts.build === "luk") luk += total;
  else {
    const each = Math.floor(total / 5);
    const remainder = total - each * 5;
    str += each + (remainder > 0 ? 1 : 0);
    dex += each + (remainder > 1 ? 1 : 0);
    vit += each + (remainder > 2 ? 1 : 0);
    spd += each + (remainder > 3 ? 1 : 0);
    luk += each + (remainder > 4 ? 1 : 0);
  }

  // Lv 29 표준 — 마정석 검 atk +7 + 골렘갑주 def +7 가정.
  const weaponAtk = 7;
  const armorDef = 7;

  const def = vit + armorDef;
  let bonusAtk = 0;
  if (opts.conv === "C") {
    bonusAtk = Math.floor(vit / 5) + Math.floor(luk / 5);
  } else if (opts.conv === "D") {
    bonusAtk =
      Math.floor(vit / 5) + Math.floor(luk / 5) + Math.floor(spd / 5);
  } else if (opts.conv === "E") {
    // vit 자체 환산 대신 def 비례 (갑옷 + vit 합산 자동 반영). luk/spd 는 5pt=1.
    bonusAtk =
      Math.floor(def / 5) + Math.floor(luk / 5) + Math.floor(spd / 5);
  }
  const atk = str + Math.floor(dex / 5) + bonusAtk + weaponAtk;
  const maxHp = maxHpForLevel(opts.level) + vit * 2;
  const evasionPct = dex * 0.5;
  const extraAttackChancePct = Math.min(100, spd * 2.5);
  const critChancePct = luk * 0.5;
  const critMult = 2.0 + luk * 0.025;
  const powerAttackBonus = str >= 10 ? 2 : 0;
  const crushDefReduction = str >= 20 ? Math.floor(str * 0.5) : 0;
  const extraAttackEveryNTurns = spd >= 10 ? 5 : undefined;
  const vanguardFirstTurnBonus = spd >= 20 ? 1 : 0;

  return {
    hp: maxHp,
    maxHp,
    atk,
    def,
    spd,
    evasionPct,
    attackCount: 1,
    extraAttackChancePct,
    powerAttackBonus,
    crushDefReduction,
    critChancePct,
    critMult,
    extraAttackEveryNTurns,
    vanguardFirstTurnBonus,
  };
}

function bossFight(player: PlayerCombat, attempts: number) {
  const boss = MONSTERS["광맥의 수호자"];
  if (!boss) throw new Error("boss not found");
  let wins = 0;
  let totalTurns = 0;
  let totalDmgTaken = 0;
  let potionTotal = 0;
  for (let i = 0; i < attempts; i += 1) {
    const p = { ...player, hp: player.maxHp };
    const result = resolveBattle(p, boss, "Sim", {
      pickAction: (state) => {
        if (state.playerHp / state.playerMaxHp < 0.5) {
          const potion = POTIONS.potion_heal_s;
          return {
            kind: "use_potion",
            potionId: "potion_heal_s",
            potion,
          };
        }
        return { kind: "attack" };
      },
      potions: { potion_heal_s: 999 },
    });
    if (result.outcome === "win") wins += 1;
    totalTurns += result.turns;
    totalDmgTaken += player.maxHp - result.finalState.playerHp;
    potionTotal += result.potionsConsumed.potion_heal_s ?? 0;
  }
  return {
    winRate: wins / attempts,
    avgTurns: totalTurns / attempts,
    avgDmgTaken: totalDmgTaken / attempts,
    avgPotions: potionTotal / attempts,
  };
}

function huntOneHour(player: PlayerCombat, regionId: string, seed: number) {
  const region = WORLD_MAP.regions.find((r) => r.id === regionId);
  if (!region) throw new Error(`region not found: ${regionId}`);
  let rngState = seed;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 0x100000000;
  };
  // 1시간 1회 — OFFLINE_SIM_MAX_MS = 1시간.
  let battles = 0;
  let wins = 0;
  let exp = 0;
  let died = 0;
  for (let chunk = 0; chunk < 1; chunk += 1) {
    const r = simulateOfflineHunt({
      player: { ...player, hp: player.maxHp },
      playerName: "Sim",
      region,
      playerLevel: 29,
      playerExp: 0,
      potions: { potion_heal_s: 99999 },
      turnIntervalMs: 500,
      awayMs: OFFLINE_SIM_MAX_MS,
      pickAction: (state) => {
        if (state.playerHp / state.playerMaxHp < 0.6) {
          return {
            kind: "use_potion",
            potionId: "potion_heal_s",
            potion: POTIONS.potion_heal_s,
          };
        }
        return { kind: "attack" };
      },
      luk: player.critChancePct ? player.critChancePct * 2 : 3,
      knowsRecipe: () => true,
      rng,
    });
    battles += r.battles;
    wins += r.wins;
    exp += r.expGained;
    if (r.died) died += 1;
  }
  return { battles, wins, exp, died };
}

describe("VIT/LUK ATK 환산 — 빌드별 시뮬 (분석용)", () => {
  const BUILDS: Build[] = ["str", "dex", "vit", "spd", "luk", "even"];
  const LEVEL = 29;

  it("광맥의 수호자 30회 — 환산 X vs C vs D vs E", () => {
    const variants: { label: string; conv: ConvMode }[] = [
      { label: "❌ 환산 X (현재)", conv: "none" },
      { label: "✅ C — vit/luk 5pt=+1", conv: "C" },
      { label: "✅ D — vit/luk/spd 5pt=+1", conv: "D" },
      { label: "✅ E — def/5 + luk/spd 5pt=+1 (vit 만 def 비례)", conv: "E" },
    ];
    for (const v of variants) {
      console.log(`\n=== ${v.label} (Lv ${LEVEL}, 보스 30회 평균) ===`);
      console.log(
        "빌드  | atk | def | maxHp | 클리어율 | 평균턴수 | 평균받피 | 평균포션",
      );
      console.log("-".repeat(80));
      for (const build of BUILDS) {
        const p = buildSpecialized({
          level: LEVEL,
          build,
          conv: v.conv,
        });
        const r = bossFight(p, 30);
        console.log(
          [
            build.padEnd(5),
            String(p.atk).padStart(3),
            String(p.def).padStart(3),
            String(p.maxHp).padStart(5),
            `${(r.winRate * 100).toFixed(0)}%`.padStart(8),
            r.avgTurns.toFixed(1).padStart(8),
            r.avgDmgTaken.toFixed(0).padStart(8),
            r.avgPotions.toFixed(1).padStart(8),
          ].join(" | "),
        );
      }
    }
  });

  it("폐허 1시간 자동 사냥 — 환산 X vs C vs D vs E", () => {
    const variants: { label: string; conv: ConvMode }[] = [
      { label: "❌ 환산 X (현재)", conv: "none" },
      { label: "✅ C — vit/luk", conv: "C" },
      { label: "✅ D — vit/luk/spd", conv: "D" },
      { label: "✅ E — def/5 + luk/spd", conv: "E" },
    ];
    for (const v of variants) {
      console.log(`\n=== ${v.label} (Lv ${LEVEL}, 폐허 1시간) ===`);
      console.log("빌드  | atk | def | 전투수 | 승   | EXP    | 사망");
      console.log("-".repeat(70));
      for (const build of BUILDS) {
        const p = buildSpecialized({
          level: LEVEL,
          build,
          conv: v.conv,
        });
        const runs = [1, 17, 34].map((s) => huntOneHour(p, "ruins", s));
        const avg = (k: keyof (typeof runs)[number]) =>
          runs.reduce((a, r) => a + (r[k] as number), 0) / runs.length;
        console.log(
          [
            build.padEnd(5),
            String(p.atk).padStart(3),
            String(p.def).padStart(3),
            avg("battles").toFixed(0).padStart(6),
            avg("wins").toFixed(0).padStart(4),
            avg("exp").toFixed(0).padStart(6),
            avg("died").toFixed(1).padStart(4),
          ].join(" | "),
        );
      }
    }
  });
});
