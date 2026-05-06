/**
 * 클래스/2차 직업별 시뮬레이션
 *
 * 사용: npx tsx scripts/dps-sim.ts
 *
 * 시나리오:
 *   A. 장비 X — 베이스 클래스 DPS
 *   B. 장비 ○ — 클래스별 추천 5피스 + 시그니처 무기
 *   C. 보스 클리어율 — Lv 100 빌드로 7개 보스 도전
 */

import {
  simulateCoopAttack,
  getAvailableSkills,
  computeStats,
  resolveBossDispatch,
} from "../src/lib/game/logic";
import { REGIONS } from "../src/lib/game/data";
import type {
  AdvancedClassId,
  Character,
  CharacterClass,
  EquipmentId,
  EquippedItems,
  Guild,
  SkillId,
} from "../src/lib/game/types";

const RUNS = 200;
const BOSS_RUNS = 100;
const TURNS = 30;

const DUMMY = { hp: 1e12, atk: 0, def: 0, mdef: 0, spd: 0, agi: 0 };

type ClassConfig = {
  label: string;
  base: CharacterClass;
  advanced?: AdvancedClassId;
};

const CONFIGS: ClassConfig[] = [
  { label: "전사 (1차)", base: "warrior" },
  { label: "광전사 (2차)", base: "warrior", advanced: "berserker" },
  { label: "방패병 (2차)", base: "warrior", advanced: "paladin" },
  { label: "도적 (1차)", base: "rogue" },
  { label: "어쌔신 (2차)", base: "rogue", advanced: "assassin" },
  { label: "맹독술사 (2차)", base: "rogue", advanced: "venom_master" },
  { label: "마법사 (1차)", base: "mage" },
  { label: "원소술사 (2차)", base: "mage", advanced: "elementalist" },
];

// 클래스별 시그니처 5피스 빌드 (lv 100+ 권장)
const LOADOUTS: Record<string, EquipmentId[]> = {
  warrior: ["ghost_helm", "ghost_armor", "ghost_gloves", "ghost_boots", "ghost_blade"],
  berserker: ["ghost_helm", "ghost_armor", "ghost_gloves", "ghost_boots", "ghost_blade"],
  paladin: [
    "guardian_helm",
    "guardian_plate",
    "ruin_gloves",
    "guardian_boots",
    "guardian_greatshield",
  ],
  rogue: ["wolf_hood", "ghost_armor", "ghost_gloves", "stalker_boots", "alpha_fang_dagger"],
  assassin: ["wolf_hood", "ghost_armor", "ghost_gloves", "stalker_boots", "alpha_fang_dagger"],
  venom_master: [
    "ghost_helm",
    "spider_queen_robe",
    "fang_gloves",
    "ghost_boots",
    "spider_silk_venomfang",
  ],
  mage: ["ghost_helm", "ghost_armor", "ghost_gloves", "ghost_boots", "spirit_staff"],
  elementalist: ["ghost_helm", "ghost_armor", "ghost_gloves", "ghost_boots", "spirit_staff"],
};

function loadoutFor(cfg: ClassConfig): EquippedItems {
  const key = cfg.advanced ?? cfg.base;
  const ids = LOADOUTS[key] ?? LOADOUTS[cfg.base];
  const e: EquippedItems = {};
  for (const id of ids) {
    // 슬롯 자동 매핑은 EQUIPMENT 데이터 필요. 간단히 키로 추론:
    if (id.includes("helm") || id.includes("hood") || id.includes("crown")) e.head = id;
    else if (id.includes("armor") || id.includes("robe") || id.includes("plate")) e.body = id;
    else if (id.includes("gloves")) e.gloves = id;
    else if (id.includes("boots")) e.boots = id;
    else if (
      id.includes("blade") ||
      id.includes("staff") ||
      id.includes("sword") ||
      id.includes("dagger") ||
      id.includes("greatshield") ||
      id.includes("venomfang") ||
      id.includes("talon")
    )
      e.weapon = id;
  }
  return e;
}

const ADVANCED_SKILLS: Record<AdvancedClassId, SkillId[]> = {
  berserker: ["blood_battle", "frenzy_burst", "dance_of_death", "hell_cry"] as SkillId[],
  paladin: ["provoke", "spike_aura", "counter_amp", "clutch_heal"] as SkillId[],
  assassin: [
    "pitch_black_dagger",
    "death_sentence",
    "shadow_clone",
    "shadowless_kick",
  ] as SkillId[],
  venom_master: ["venom_spray", "venom_amp", "decay_touch", "death_mist"] as SkillId[],
  elementalist: [
    "fire_element",
    "ice_element",
    "lightning_element",
    "elemental_combo",
  ] as SkillId[],
};

function makeCharacter(cfg: ClassConfig, level: number, withEquipment: boolean): Character {
  const c: Character = {
    name: "Sim",
    level,
    exp: 0,
    skillExp: 0,
    currentClass: cfg.base,
    advancedClass: cfg.advanced,
    currentHp: 1,
    learnedAdvancedSkills: cfg.advanced ? [...ADVANCED_SKILLS[cfg.advanced]] : [],
    equipped: withEquipment ? loadoutFor(cfg) : undefined,
  };
  const max = cfg.advanced ? 6 : 5;
  c.equippedSkills = getAvailableSkills(c)
    .slice(0, max)
    .map((s) => s.id);
  c.currentHp = computeStats(c).maxHp;
  return c;
}

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
}

function std(arr: number[], mean: number): number {
  const v = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, arr.length);
  return Math.sqrt(v);
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function dpsScenario(level: number, withEquipment: boolean): void {
  const tag = withEquipment ? "장비 ○" : "장비 X";
  console.log(`\n=== Lv ${level} (${tag}, ${TURNS}턴 × ${RUNS}회) ===`);
  console.log(
    "직업".padEnd(20) +
      "ATK".padStart(7) +
      "INT".padStart(7) +
      "AGI".padStart(5) +
      "HP".padStart(8) +
      "  | " +
      "DMG/턴".padStart(9) +
      "  ±std".padStart(8),
  );
  console.log("-".repeat(80));
  const results = CONFIGS.map((cfg) => {
    const c = makeCharacter(cfg, level, withEquipment);
    const stats = computeStats(c);
    const damages: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const r = simulateCoopAttack(c, DUMMY, TURNS, { noCounter: true });
      damages.push(r.damageDealt);
    }
    const m = avg(damages);
    const s = std(damages, m);
    return { label: cfg.label, stats, dmgPerTurn: m / TURNS, std: s / TURNS };
  });
  results.sort((a, b) => b.dmgPerTurn - a.dmgPerTurn);
  for (const r of results) {
    console.log(
      r.label.padEnd(20) +
        Math.round(r.stats.atk).toString().padStart(7) +
        Math.round(r.stats.int).toString().padStart(7) +
        Math.round(r.stats.agi).toString().padStart(5) +
        Math.round(r.stats.maxHp).toString().padStart(8) +
        "  | " +
        fmt(r.dmgPerTurn).padStart(9) +
        ("±" + fmt(r.std)).padStart(8),
    );
  }
}

function bossClearScenario(level: number): void {
  console.log(`\n=== Lv ${level} 빌드별 보스 클리어 (${BOSS_RUNS}회 도전) ===`);
  const guild: Guild = { reputation: 100 };
  // 대표 보스 7개 (외곽~심연)
  const bossRegions = REGIONS.filter((r) =>
    ["plains", "cave", "ruins", "snowfield", "ghost_ship", "abyss_edge", "abyss_core"].includes(
      r.id,
    ),
  );
  console.log(
    "직업".padEnd(20) + bossRegions.map((r) => r.boss!.name.slice(0, 6).padStart(8)).join(""),
  );
  console.log("-".repeat(20 + bossRegions.length * 8));
  for (const cfg of CONFIGS) {
    const c = makeCharacter(cfg, level, true);
    const cells: string[] = [];
    for (const region of bossRegions) {
      let wins = 0;
      let totalTurns = 0;
      for (let i = 0; i < BOSS_RUNS; i++) {
        const r = resolveBossDispatch({ ...c, currentHp: computeStats(c).maxHp }, region, guild);
        if (r.defeated) {
          wins++;
          totalTurns += r.totalTurns;
        }
      }
      const winRate = (wins / BOSS_RUNS) * 100;
      const avgTurns = wins > 0 ? Math.round(totalTurns / wins) : 0;
      let cell: string;
      if (winRate >= 95) cell = `${avgTurns}T`;
      else if (winRate >= 50) cell = `${Math.round(winRate)}%`;
      else if (winRate > 0) cell = `${Math.round(winRate)}%`.padStart(4);
      else cell = "  ✗";
      cells.push(cell.padStart(8));
    }
    console.log(cfg.label.padEnd(20) + cells.join(""));
  }
  console.log("  (95%↑: 평균턴 표시, 50~94%: 승률, 1~49%: 승률, 0%: ✗)");
}

console.log("=== 시뮬레이션 ===");
console.log("A. 클래스별 DPS — 무반격 더미");
console.log(`B. 보스 클리어율 — 실제 보스 (반격 포함, ${BOSS_RUNS}회 도전)`);

console.log("\n--- A. DPS (장비 X) ---");
dpsScenario(100, false);

console.log("\n--- A. DPS (장비 ○) ---");
dpsScenario(100, true);
dpsScenario(150, true);
dpsScenario(200, true);

console.log("\n--- B. 보스 클리어율 ---");
bossClearScenario(100);
bossClearScenario(150);
bossClearScenario(200);
