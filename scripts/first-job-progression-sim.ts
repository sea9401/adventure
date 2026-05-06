/**
 * 1차 전직 상태 진행도 시뮬레이션
 *
 * 가정: 2차 전직에 퀘스트가 부여되어 1차 전직만으로 컨텐츠를 돌아야 한다.
 * Lv 100 1차 전직 캐릭터가 "적당한 스펙업"을 챙겼을 때
 * 어디까지 무난하게 돌 수 있는지 보스/사냥터별 통계를 낸다.
 *
 * 사용: npx tsx scripts/first-job-progression-sim.ts
 *
 * 시나리오 (3단계 스펙업):
 *   1. 베이스       — Lv 100 1차, 장비/명전/도감 없음
 *   2. 중간 스펙업  — Lv 100 1차 + 설원 세트 + 명전 lv5 (기본 보스 30킬) + 도감 5pt
 *   3. 적당 스펙업  — Lv 100 1차 + 유령 세트 + 명전 lv10 (1~8보스 캡100/30, 후반0) + 도감 15pt
 *
 * 측정:
 *   A. 11개 필드 보스 (resolveBossDispatch) — 승률, 평균 턴, 평균 잔여 HP%
 *   B. 11개 사냥터 (resolveDispatch, 60초) — kills/min, EXP/min, 사망률
 */

import {
  resolveBossDispatch,
  resolveDispatch,
  computeStats,
  getMonumentBonus,
  getAvailableSkills,
  type MonumentExtra,
} from "../src/lib/game/logic";
import { REGIONS } from "../src/lib/game/data";
import type {
  Character,
  CharacterClass,
  CodexState,
  CodexStatKey,
  EquipmentId,
  EquippedItems,
  Guild,
} from "../src/lib/game/types";

const RUNS = 300;
const HUNT_DURATION = 60;
const guild: Guild = { reputation: 100 };

type Tier = "베이스" | "중간" | "적당";

const LOADOUTS: Record<Tier, Partial<Record<Exclude<CharacterClass, "none">, EquippedItems>>> = {
  베이스: {
    warrior: {},
    rogue: {},
    mage: {},
  },
  중간: {
    // 설원 세트 — Lv 65~90 권장, 풀 제작 가능
    warrior: {
      head: "frost_helm",
      body: "glacier_armor",
      gloves: "ice_gloves",
      boots: "glacier_boots",
      weapon: "glacier_blade",
    },
    rogue: {
      head: "frost_helm",
      body: "glacier_armor",
      gloves: "ice_gloves",
      boots: "glacier_boots",
      weapon: "glacier_blade",
    },
    mage: {
      head: "frost_helm",
      body: "glacier_armor",
      gloves: "ice_gloves",
      boots: "glacier_boots",
      weapon: "glacier_blade",
    },
  },
  적당: {
    // 유령 세트 — Lv 90~100 권장, 1차 전직 상한 가능 best
    warrior: {
      head: "ghost_helm",
      body: "ghost_armor",
      gloves: "ghost_gloves",
      boots: "ghost_boots",
      weapon: "ghost_blade",
    },
    rogue: {
      head: "ghost_helm",
      body: "ghost_armor",
      gloves: "ghost_gloves",
      boots: "ghost_boots",
      weapon: "ghost_blade",
    },
    mage: {
      head: "ghost_helm",
      body: "ghost_armor",
      gloves: "ghost_gloves",
      boots: "ghost_boots",
      weapon: "ghost_blade",
    },
  },
};

// 클래스별 도감 포인트 분배 (적당 시나리오: 15pt)
const CODEX_ALLOC: Record<
  Exclude<CharacterClass, "none">,
  Partial<Record<CodexStatKey, number>>
> = {
  warrior: { hp: 5, str: 5, vit: 5 },
  rogue: { str: 5, agi: 5, hp: 5 },
  mage: { matk: 5, hp: 5, str: 5 },
};

const CODEX_ALLOC_MID: Record<
  Exclude<CharacterClass, "none">,
  Partial<Record<CodexStatKey, number>>
> = {
  warrior: { hp: 2, str: 2, vit: 1 },
  rogue: { str: 2, agi: 2, hp: 1 },
  mage: { matk: 2, hp: 2, str: 1 },
};

// 명전 보스 킬카운트 시나리오
const KILLS_MID: Record<string, number> = {
  "거대 슬라임 왕": 30,
  "늑대 우두머리": 30,
  "거미 여왕": 30,
  "잠든 가디언": 30,
  "거대 전갈": 20,
  "서리 거인": 10,
};

const KILLS_FULL: Record<string, number> = {
  "거대 슬라임 왕": 100,
  "늑대 우두머리": 100,
  "거미 여왕": 100,
  "잠든 가디언": 100,
  "거대 전갈": 80,
  "서리 거인": 50,
  "해적 선장": 30,
  "유령 선장": 10,
};

const MONUMENT_LV: Record<Tier, number> = {
  베이스: 0,
  중간: 5,
  적당: 10,
};

const KILLS_BY_TIER: Record<Tier, Record<string, number>> = {
  베이스: {},
  중간: KILLS_MID,
  적당: KILLS_FULL,
};

function makeCharacter(cls: Exclude<CharacterClass, "none">, tier: Tier): Character {
  const codex: CodexState | undefined =
    tier === "베이스"
      ? undefined
      : {
          materials: [],
          equipment: [],
          allocated: tier === "적당" ? CODEX_ALLOC[cls] : CODEX_ALLOC_MID[cls],
        };
  const c: Character = {
    name: "Sim",
    level: 100,
    exp: 0,
    skillExp: 0,
    currentClass: cls,
    currentHp: 1,
    equipped: LOADOUTS[tier][cls],
    codex,
  };
  c.equippedSkills = getAvailableSkills(c)
    .slice(0, 5)
    .map((s) => s.id);
  c.currentHp = computeStats(c, getMonBonus(tier)).maxHp;
  return c;
}

function getMonBonus(tier: Tier): MonumentExtra {
  return getMonumentBonus(MONUMENT_LV[tier], KILLS_BY_TIER[tier]);
}

function fmt(n: number, w: number = 0): string {
  return Math.round(n).toLocaleString().padStart(w);
}

function fmtPct(n: number, w: number = 0): string {
  return (n.toFixed(0) + "%").padStart(w);
}

const CLASS_LABELS: Record<Exclude<CharacterClass, "none">, string> = {
  warrior: "전사",
  rogue: "도적",
  mage: "마법사",
};

const CLASSES: Exclude<CharacterClass, "none">[] = ["warrior", "rogue", "mage"];
const TIERS: Tier[] = ["베이스", "중간", "적당"];

// ========== 0. 스탯 요약 ==========
function statsTable() {
  console.log("\n========== Lv 100 1차 전직 — 스펙업 단계별 최종 스탯 ==========");
  console.log(
    "직업".padEnd(8) +
      "스펙".padEnd(8) +
      "HP".padStart(8) +
      "ATK".padStart(7) +
      "DEF".padStart(7) +
      "MDEF".padStart(6) +
      "INT".padStart(7) +
      "AGI".padStart(6) +
      "SPD".padStart(6) +
      "  | 회피%  치명%",
  );
  console.log("-".repeat(80));
  for (const cls of CLASSES) {
    for (const tier of TIERS) {
      const c = makeCharacter(cls, tier);
      const s = computeStats(c, getMonBonus(tier));
      const dodge = Math.min(60, s.agi * 0.002 * 100);
      const baseCrit = Math.min(30, s.agi * 0.001 * 100);
      const critPassive = cls === "rogue" ? 15 : 0;
      console.log(
        CLASS_LABELS[cls].padEnd(8) +
          tier.padEnd(8) +
          fmt(s.maxHp, 8) +
          fmt(s.atk, 7) +
          fmt(s.def, 7) +
          fmt(s.mdef, 6) +
          fmt(s.int, 7) +
          fmt(s.agi, 6) +
          fmt(s.spd, 6) +
          "  | " +
          fmtPct(dodge, 5) +
          " " +
          fmtPct(baseCrit + critPassive, 5),
      );
    }
    console.log("-".repeat(80));
  }
}

// ========== A. 보스 클리어율 ==========
type BossStat = {
  bossName: string;
  bossHp: number;
  bossAtk: number;
  winRate: number;
  avgTurns: number;
  avgFinalHpPct: number;
  earlyDeath: number;
};

function bossSimulation(cls: Exclude<CharacterClass, "none">, tier: Tier): BossStat[] {
  const out: BossStat[] = [];
  const bossRegions = REGIONS.filter((r) => r.boss);
  const mon = getMonBonus(tier);
  for (const region of bossRegions) {
    let wins = 0;
    let totalTurns = 0;
    let totalFinalHp = 0;
    let earlyDeath = 0;
    const cBase = makeCharacter(cls, tier);
    const maxHp = computeStats(cBase, mon).maxHp;
    for (let i = 0; i < RUNS; i++) {
      const c: Character = { ...cBase, currentHp: maxHp };
      const r = resolveBossDispatch(c, region, guild, mon);
      if (r.defeated) {
        wins++;
        totalTurns += r.totalTurns;
      }
      totalFinalHp += r.finalHp / maxHp;
      if (r.diedEarly) earlyDeath++;
    }
    out.push({
      bossName: region.boss!.name,
      bossHp: region.boss!.hp,
      bossAtk: region.boss!.atk,
      winRate: (wins / RUNS) * 100,
      avgTurns: wins > 0 ? totalTurns / wins : 0,
      avgFinalHpPct: (totalFinalHp / RUNS) * 100,
      earlyDeath: (earlyDeath / RUNS) * 100,
    });
  }
  return out;
}

function bossTable() {
  console.log("\n========== A. 필드 보스 클리어율 (RUNS=" + RUNS + ") ==========");
  for (const tier of TIERS) {
    console.log(`\n--- 시나리오: ${tier} 스펙 ---`);
    const headerBosses = REGIONS.filter((r) => r.boss).map((r) => r.boss!.name);
    let header = "직업".padEnd(8);
    for (const name of headerBosses) header += name.slice(0, 6).padStart(8);
    console.log(header);
    console.log("-".repeat(8 + headerBosses.length * 8));
    for (const cls of CLASSES) {
      const stats = bossSimulation(cls, tier);
      let line = CLASS_LABELS[cls].padEnd(8);
      for (const s of stats) {
        if (s.winRate >= 95) line += `${Math.round(s.avgTurns)}T`.padStart(8);
        else if (s.winRate >= 1) line += `${Math.round(s.winRate)}%`.padStart(8);
        else line += "  ✗".padStart(8);
      }
      console.log(line);
    }
  }
  console.log("\n  표시 규칙: 95%+ 승률 = 평균턴 표기 / 1~94% = 승률 / 0% = ✗");
}

// ========== B. 사냥터 효율 ==========
type HuntStat = {
  regionName: string;
  enemyHpRange: string;
  enemyAtkRange: string;
  killsPerMin: number;
  expPerMin: number;
  goldPerMin: number;
  deathRate: number;
  avgFinalHpPct: number;
  dodgeMonster: number; // monster missed
};

function huntSimulation(cls: Exclude<CharacterClass, "none">, tier: Tier): HuntStat[] {
  const out: HuntStat[] = [];
  const mon = getMonBonus(tier);
  for (const region of REGIONS) {
    let totalKills = 0;
    let totalExp = 0;
    let totalGold = 0;
    let deaths = 0;
    let totalFinalHp = 0;
    const cBase = makeCharacter(cls, tier);
    const maxHp = computeStats(cBase, mon).maxHp;
    for (let i = 0; i < RUNS; i++) {
      const c: Character = { ...cBase, currentHp: maxHp };
      const r = resolveDispatch(c, region, guild, HUNT_DURATION, mon);
      totalKills += r.totalKills;
      totalExp += r.exp;
      totalGold += r.gained.gold ?? 0;
      if (r.diedEarly) deaths++;
      totalFinalHp += r.finalHp / maxHp;
    }
    const enemyHps = region.enemies.map((e) => e.hp);
    const enemyAtks = region.enemies.map((e) => e.atk);
    out.push({
      regionName: region.name,
      enemyHpRange: `${Math.min(...enemyHps)}-${Math.max(...enemyHps)}`,
      enemyAtkRange: `${Math.min(...enemyAtks)}-${Math.max(...enemyAtks)}`,
      killsPerMin: totalKills / RUNS,
      expPerMin: totalExp / RUNS,
      goldPerMin: totalGold / RUNS,
      deathRate: (deaths / RUNS) * 100,
      avgFinalHpPct: (totalFinalHp / RUNS) * 100,
      dodgeMonster: 0,
    });
  }
  return out;
}

function huntTable() {
  console.log("\n========== B. 사냥터 효율 (60초 파견 × " + RUNS + "회) ==========");
  for (const tier of TIERS) {
    console.log(`\n--- 시나리오: ${tier} 스펙 ---`);
    console.log(
      "지역".padEnd(12) +
        "몹 HP".padStart(10) +
        "몹 ATK".padStart(10) +
        "  | " +
        "전사 K/HP%/사망%".padEnd(20) +
        " 도적 K/HP%/사망%".padEnd(21) +
        " 마법사 K/HP%/사망%",
    );
    console.log("-".repeat(110));
    const huntByCls: Record<Exclude<CharacterClass, "none">, HuntStat[]> = {
      warrior: huntSimulation("warrior", tier),
      rogue: huntSimulation("rogue", tier),
      mage: huntSimulation("mage", tier),
    };
    for (let i = 0; i < REGIONS.length; i++) {
      const w = huntByCls.warrior[i];
      const r = huntByCls.rogue[i];
      const m = huntByCls.mage[i];
      const region = w.regionName.slice(0, 11);
      let line =
        region.padEnd(12) + w.enemyHpRange.padStart(10) + w.enemyAtkRange.padStart(10) + "  | ";
      const cell = (h: HuntStat) =>
        `${h.killsPerMin.toFixed(1)}/${h.avgFinalHpPct.toFixed(0)}%/${h.deathRate.toFixed(0)}%`.padEnd(
          20,
        );
      line += cell(w) + cell(r) + cell(m);
      console.log(line);
    }
  }
  console.log("\n  K = 60초당 처치 수, HP% = 종료 시 평균 잔여 HP%, 사망% = 60초 내 사망률");
}

// ========== Main ==========
console.log("================================================================");
console.log("   1차 전직 진행도 시뮬레이션 — 2차 전직 퀘스트 가정 시나리오");
console.log("================================================================");
console.log(`Lv 100 / RUNS=${RUNS} / 사냥 파견 ${HUNT_DURATION}초`);
console.log("\n[명전 킬카운트 — 적당 스펙]");
for (const [k, v] of Object.entries(KILLS_FULL)) console.log(`  ${k}: ${v}킬`);
console.log("[명전 킬카운트 — 중간 스펙]");
for (const [k, v] of Object.entries(KILLS_MID)) console.log(`  ${k}: ${v}킬`);
console.log("[도감 분배 — 적당 스펙]");
for (const cls of CLASSES)
  console.log(`  ${CLASS_LABELS[cls]}: ${JSON.stringify(CODEX_ALLOC[cls])}`);

statsTable();
bossTable();
huntTable();
