// 협동 보스 처치 가능성 시뮬 — hp 2000 운봉의 거인을 N명 플레이어가 잡는다.
// 1회 공격 = 20턴 시뮬, 5분 쿨다운(시뮬에선 무시 — 라운드 단위로 공격).
// 검증 포인트:
//   - 인원수별 평균 처치 라운드 (총 공격 횟수)
//   - 빌드별 평균 1회 데미지
//   - 한 빌드가 한 방으로 25% 초과 못 가져가는지 (한방컷 차단)
//   - 사망률 (보스 반격으로)
//
// 실행: npm test -- coopBossSim

import { describe, it } from "vitest";
import { simulateCoopAttack } from "./simulate";
import { COOP_BOSSES } from "./data";
import { maxHpForLevel } from "@/adventure/character/defaults";
import type { PlayerCombat } from "@/adventure/battle/engine";

type Kit = "partial" | "full";
type StatDist = "even" | "warrior";

function buildPlayer(level: number, kit: Kit = "full", dist: StatDist = "even"): PlayerCombat {
  const pts = Math.max(0, level - 1);
  let allocated: [number, number, number, number, number];
  if (dist === "warrior") {
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

  let weaponAtk = 0;
  let armorDef = 0;
  let bonusAtk = 0;

  if (kit === "full") {
    if (level >= 12) {
      weaponAtk = 7;
      str += 3;
    } else if (level >= 8) {
      weaponAtk = 5;
      dex += 1;
    } else if (level >= 5) {
      weaponAtk = 4;
      dex += 2;
    }
    if (level >= 14) {
      armorDef = 7;
      bonusAtk -= 1;
      spd -= 3;
      luk -= 1;
    } else if (level >= 5) {
      armorDef = 3;
    }
    if (level >= 12) {
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
    }
    if (level >= 5) armorDef = 3;
  }

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

  return {
    hp: maxHp,
    maxHp,
    atk,
    def,
    spd,
    evasionPct: dex * 0.5,
    attackCount: 1,
    extraAttackChancePct: Math.min(100, spd * 2.5),
    critChancePct: luk * 0.5,
    powerAttackBonus: str >= 10 ? 2 : 0,
    crushDefReduction: str >= 20 ? Math.floor(str * 0.5) : 0,
    extraAttackEveryNTurns: spd >= 15 ? 5 : 0,
    vanguardFirstTurnBonus: spd >= 30 ? 1 : 0,
  };
}

const BOSS = COOP_BOSSES.canyon!;

// 1회 공격 결과 통계.
function attackOnce(player: PlayerCombat, currentHp: number): {
  damage: number;
  finalHp: number;
  died: boolean;
} {
  const r = simulateCoopAttack({
    player,
    playerName: "Sim",
    bossName: BOSS.monsterName,
    bossCurrentHp: currentHp,
    bossMaxHp: BOSS.maxHp,
    turns: 20,
  });
  return {
    damage: r.damageDealt,
    finalHp: r.finalPlayerHp,
    died: r.diedEarly,
  };
}

describe("협동 보스 처치 시뮬", () => {
  it("빌드별 1회 공격 평균 데미지 (10시드 평균)", () => {
    const BUILDS: Array<{ name: string; level: number; kit: Kit; dist: StatDist }> = [
      { name: "Lv18 partial · even   ", level: 18, kit: "partial", dist: "even" },
      { name: "Lv18 full    · even   ", level: 18, kit: "full", dist: "even" },
      { name: "Lv20 full    · even   ", level: 20, kit: "full", dist: "even" },
      { name: "Lv20 full    · warrior", level: 20, kit: "full", dist: "warrior" },
      { name: "Lv22 full    · warrior", level: 22, kit: "full", dist: "warrior" },
      { name: "Lv25 full    · warrior", level: 25, kit: "full", dist: "warrior" },
    ];

    console.log("\n=== 협동 보스 1회 공격 데미지 (보스 hp 2,000 기준, 10회 평균) ===");
    console.log("빌드                       | ATK/DEF/HP | 평균 dmg | 비율% | 한방 25% 초과? | 사망률");
    console.log("-".repeat(105));
    for (const b of BUILDS) {
      const proto = buildPlayer(b.level, b.kit, b.dist);
      const runs = 10;
      let totalDmg = 0;
      let deaths = 0;
      let maxDmg = 0;
      for (let i = 0; i < runs; i += 1) {
        const r = attackOnce(proto, BOSS.maxHp);
        totalDmg += r.damage;
        if (r.died) deaths += 1;
        if (r.damage > maxDmg) maxDmg = r.damage;
      }
      const avgDmg = totalDmg / runs;
      const ratio = (avgDmg / BOSS.maxHp) * 100;
      const oneShot25 = (maxDmg / BOSS.maxHp) > 0.25 ? "⚠ YES" : "OK";
      console.log(
        [
          b.name.padEnd(26),
          `${proto.atk}/${proto.def}/${proto.maxHp}`.padStart(10),
          avgDmg.toFixed(0).padStart(8),
          ratio.toFixed(1).padStart(5),
          `(max ${((maxDmg / BOSS.maxHp) * 100).toFixed(1)}%) ${oneShot25}`.padStart(15),
          `${(deaths * 100 / runs).toFixed(0)}%`.padStart(6),
        ].join(" | "),
      );
    }
  });

  it("인원수별 처치 라운드 — 균등 빌드 4종 ", () => {
    // 4명이 라운드제로 돌아가며 공격, 보스 hp 0 될 때까지.
    // 각 인원수 시나리오 5회 평균.
    const SCENARIOS: Array<{ label: string; players: Array<{ level: number; kit: Kit; dist: StatDist }> }> = [
      {
        label: "1명 단독 (Lv 22 warrior)",
        players: [{ level: 22, kit: "full", dist: "warrior" }],
      },
      {
        label: "2명 (Lv 22 warrior 둘)",
        players: [
          { level: 22, kit: "full", dist: "warrior" },
          { level: 22, kit: "full", dist: "warrior" },
        ],
      },
      {
        label: "3명 (Lv 22 warrior 둘 + Lv 18 even 하나)",
        players: [
          { level: 22, kit: "full", dist: "warrior" },
          { level: 22, kit: "full", dist: "warrior" },
          { level: 18, kit: "full", dist: "even" },
        ],
      },
      {
        label: "4명 (Lv 22 warrior 둘 + Lv 20 even 둘)",
        players: [
          { level: 22, kit: "full", dist: "warrior" },
          { level: 22, kit: "full", dist: "warrior" },
          { level: 20, kit: "full", dist: "even" },
          { level: 20, kit: "full", dist: "even" },
        ],
      },
      {
        label: "5명 (모두 Lv 20 even)",
        players: [
          { level: 20, kit: "full", dist: "even" },
          { level: 20, kit: "full", dist: "even" },
          { level: 20, kit: "full", dist: "even" },
          { level: 20, kit: "full", dist: "even" },
          { level: 20, kit: "full", dist: "even" },
        ],
      },
    ];

    console.log("\n=== 인원수별 협동 처치 라운드 (라운드제 공격, 5시드 평균) ===");
    console.log("시나리오                                      | 평균 라운드 | 평균 인당공격 | 평균 처치 분(5분쿨)");
    console.log("-".repeat(105));
    for (const s of SCENARIOS) {
      const runs = 5;
      let totalRounds = 0;
      for (let seed = 0; seed < runs; seed += 1) {
        const players = s.players.map((p) => buildPlayer(p.level, p.kit, p.dist));
        let hp = BOSS.maxHp;
        let rounds = 0;
        const deaths = new Array(players.length).fill(false);
        while (hp > 0 && rounds < 200) {
          rounds += 1;
          for (let i = 0; i < players.length; i += 1) {
            if (hp <= 0) break;
            if (deaths[i]) continue; // 죽은 사람은 패스 (실제론 회복 후 복귀)
            const r = attackOnce(players[i], hp);
            hp = Math.max(0, hp - r.damage);
            if (r.died) deaths[i] = true;
          }
          // 한 라운드(모두 한 번씩) = 실제 5분 쿨다운 사이클로 가정.
        }
        totalRounds += rounds;
      }
      const avgRounds = totalRounds / runs;
      const avgPerPerson = avgRounds; // 각 라운드마다 1회씩 — 인당 공격 횟수 = rounds
      const minutes = (avgRounds * 5).toFixed(0); // 5분 쿨다운 가정
      console.log(
        [
          s.label.padEnd(46),
          avgRounds.toFixed(1).padStart(11),
          `${avgPerPerson.toFixed(1)}회`.padStart(13),
          `~${minutes}분`.padStart(20),
        ].join(" | "),
      );
    }
  });
});
