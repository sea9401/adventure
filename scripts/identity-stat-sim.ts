/**
 * 직업 정체성 자원 격상 계수 시뮬레이션 (docs/20 §7 결정 보류 항목)
 *
 * 결정 항목:
 *   #1. 단일 효과 계수 (STR→ATK, MATK→INT): 1.3 vs 1.4
 *   #2. 이중 효과 계수 (VIT→DEF, AGI→회피·크리): 1.15 vs 1.2
 *   #3. vitToHp 절대값: 2 vs 3
 *
 * 사용: npx tsx scripts/identity-stat-sim.ts
 *
 * 측정 지점:
 *   - 1차: lv 30 / 50 / 100
 *   - 2차: lv 150 (광전사·방패병·어쌔신·맹독술사·원소술사)
 *   - 외부 보너스 누적: codex 10pt (100 STR/VIT/AGI/MATK)
 */

import { CLASSES, ADVANCED_CLASSES, AGI_DODGE_RATE, AGI_CRIT_RATE } from "../src/lib/game/data";
import type { CharacterClass, AdvancedClassId, ClassDef } from "../src/lib/game/types";

type Coeff = {
  strToAtkMult: number;
  vitToDefMult: number;
  vitToHp: number;
  agiDodgeMult: number;
  agiCritMult: number;
  matkToIntMult: number;
};

const baseline: Coeff = {
  strToAtkMult: 1,
  vitToDefMult: 1,
  vitToHp: 0,
  agiDodgeMult: 1,
  agiCritMult: 1,
  matkToIntMult: 1,
};

// 1차/2차 직업 베이스 스탯 (확장 시점 — 장비 0)
function calcPrimary(
  cls: CharacterClass,
  lv: number,
  c: Coeff,
  extraStr = 0,
  extraVit = 0,
  extraAgi = 0,
  extraMatk = 0,
) {
  const def = CLASSES[cls];
  const lvB = lv - 1;
  const str = (def.baseStr ?? 0) + (def.growStr ?? 0) * lvB + extraStr;
  const vit = (def.baseVit ?? 0) + (def.growVit ?? 0) * lvB + extraVit;
  const agi = def.baseAgi + def.growAgi * lvB + extraAgi;
  const matk = (def.baseMatk ?? 0) + (def.growMatk ?? 0) * lvB + extraMatk;
  const intStat = def.baseInt + def.growInt * lvB + matk * c.matkToIntMult;
  const atk = def.baseAtk + def.growAtk * lvB + str * c.strToAtkMult;
  const def_ = def.baseDef + def.growDef * lvB + vit * c.vitToDefMult;
  const hp = def.baseHp + def.growHp * lvB + vit * c.vitToHp;
  const dodgePct = Math.min(60, agi * AGI_DODGE_RATE * c.agiDodgeMult * 100);
  const agiCritPct = Math.min(30, agi * AGI_CRIT_RATE * c.agiCritMult * 100);
  return { hp, atk, def: def_, int: intStat, agi, dodgePct, agiCritPct, str, vit, matk };
}

function calcAdvanced(adv: AdvancedClassId, lv: number, c: Coeff) {
  const a = ADVANCED_CLASSES[adv];
  const parent = CLASSES[a.parent];
  const lvB = lv - 1;
  const m = (k: keyof typeof a.growMult): number => a.growMult[k] ?? 1;
  const b = (k: string): number => (a.growBonus as Record<string, number> | undefined)?.[k] ?? 0;
  const str = (parent.baseStr ?? 0) + ((parent.growStr ?? 0) * m("str") + b("str")) * lvB;
  const vit = (parent.baseVit ?? 0) + ((parent.growVit ?? 0) * m("vit") + b("vit")) * lvB;
  const agi = parent.baseAgi + (parent.growAgi * m("agi") + b("agi")) * lvB;
  const matk = (parent.baseMatk ?? 0) + ((parent.growMatk ?? 0) * m("matk") + b("matk")) * lvB;
  const intStat =
    parent.baseInt + (parent.growInt * m("int") + b("int")) * lvB + matk * c.matkToIntMult;
  const atk = parent.baseAtk + (parent.growAtk * m("atk") + b("atk")) * lvB + str * c.strToAtkMult;
  const def_ = parent.baseDef + (parent.growDef * m("def") + b("def")) * lvB + vit * c.vitToDefMult;
  const hp = parent.baseHp + (parent.growHp * m("hp") + b("hp")) * lvB + vit * c.vitToHp;
  const dodgePct = Math.min(60, agi * AGI_DODGE_RATE * c.agiDodgeMult * 100);
  const agiCritPct = Math.min(30, agi * AGI_CRIT_RATE * c.agiCritMult * 100);
  // 광전사 ATK 패시브 +45% 적용 후 표시값
  let effAtk = atk;
  if (adv === "berserker") effAtk = atk * 1.45;
  return { hp, atk, effAtk, def: def_, int: intStat, agi, dodgePct, agiCritPct, str, vit, matk };
}

const fmt = (n: number, d = 0) => n.toFixed(d);

console.log("\n=== #1: 단일 효과 계수 (STR→ATK, MATK→INT) — 1.3 vs 1.4 ===\n");
console.log("전사·광전사·마법사·원소술사 ATK/INT 비교 (장비 0)\n");

const c10: Coeff = { ...baseline };
const c13: Coeff = { ...baseline, strToAtkMult: 1.3, matkToIntMult: 1.3 };
const c14: Coeff = { ...baseline, strToAtkMult: 1.4, matkToIntMult: 1.4 };

const cases = [
  {
    label: "전사 lv 30",
    fn: () => calcPrimary("warrior", 30, c10).atk,
    fn13: () => calcPrimary("warrior", 30, c13).atk,
    fn14: () => calcPrimary("warrior", 30, c14).atk,
  },
  {
    label: "전사 lv 50",
    fn: () => calcPrimary("warrior", 50, c10).atk,
    fn13: () => calcPrimary("warrior", 50, c13).atk,
    fn14: () => calcPrimary("warrior", 50, c14).atk,
  },
  {
    label: "전사 lv 100",
    fn: () => calcPrimary("warrior", 100, c10).atk,
    fn13: () => calcPrimary("warrior", 100, c13).atk,
    fn14: () => calcPrimary("warrior", 100, c14).atk,
  },
  {
    label: "광전사 lv 150 (패시브 후)",
    fn: () => calcAdvanced("berserker", 150, c10).effAtk,
    fn13: () => calcAdvanced("berserker", 150, c13).effAtk,
    fn14: () => calcAdvanced("berserker", 150, c14).effAtk,
  },
  {
    label: "마법사 lv 100 (INT)",
    fn: () => calcPrimary("mage", 100, c10).int,
    fn13: () => calcPrimary("mage", 100, c13).int,
    fn14: () => calcPrimary("mage", 100, c14).int,
  },
  {
    label: "원소술사 lv 150 (INT)",
    fn: () => calcAdvanced("elementalist", 150, c10).int,
    fn13: () => calcAdvanced("elementalist", 150, c13).int,
    fn14: () => calcAdvanced("elementalist", 150, c14).int,
  },
];

console.log("| 시나리오 | 1.0 (현재) | ×1.3 | %증감 | ×1.4 | %증감 |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
for (const c of cases) {
  const v0 = c.fn();
  const v13 = c.fn13();
  const v14 = c.fn14();
  console.log(
    `| ${c.label} | ${fmt(v0)} | ${fmt(v13)} | +${fmt(((v13 - v0) / v0) * 100, 1)}% | ${fmt(v14)} | +${fmt(((v14 - v0) / v0) * 100, 1)}% |`,
  );
}

console.log("\n외부 누적 보너스 시뮬 (codex 10pt = 100 STR 추가, 전사 lv 100):");
const w100_0 = calcPrimary("warrior", 100, c10, 100).atk;
const w100_13 = calcPrimary("warrior", 100, c13, 100).atk;
const w100_14 = calcPrimary("warrior", 100, c14, 100).atk;
const w100_0_no = calcPrimary("warrior", 100, c10).atk;
console.log(`  현재 (1.0): ${fmt(w100_0)} ATK (+${fmt(w100_0 - w100_0_no)} from 100 STR)`);
console.log(
  `  1.3:       ${fmt(w100_13)} ATK (+${fmt(w100_13 - calcPrimary("warrior", 100, c13).atk)} from 100 STR)`,
);
console.log(
  `  1.4:       ${fmt(w100_14)} ATK (+${fmt(w100_14 - calcPrimary("warrior", 100, c14).atk)} from 100 STR)`,
);

console.log("\n\n=== #2: 이중 효과 계수 (VIT→DEF, AGI→회피·크리) — 1.15 vs 1.2 ===\n");

const c2_15: Coeff = { ...baseline, vitToDefMult: 1.15, agiDodgeMult: 1.15, agiCritMult: 1.15 };
const c2_20: Coeff = { ...baseline, vitToDefMult: 1.2, agiDodgeMult: 1.2, agiCritMult: 1.2 };

console.log("VIT→DEF (전사·방패병):");
console.log("| 시나리오 | 1.0 | ×1.15 | %증감 | ×1.2 | %증감 |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
const def_cases = [
  {
    label: "전사 lv 50 DEF",
    v0: calcPrimary("warrior", 50, c10).def,
    v15: calcPrimary("warrior", 50, c2_15).def,
    v20: calcPrimary("warrior", 50, c2_20).def,
  },
  {
    label: "전사 lv 100 DEF",
    v0: calcPrimary("warrior", 100, c10).def,
    v15: calcPrimary("warrior", 100, c2_15).def,
    v20: calcPrimary("warrior", 100, c2_20).def,
  },
  {
    label: "방패병 lv 150 DEF",
    v0: calcAdvanced("paladin", 150, c10).def,
    v15: calcAdvanced("paladin", 150, c2_15).def,
    v20: calcAdvanced("paladin", 150, c2_20).def,
  },
];
for (const c of def_cases) {
  console.log(
    `| ${c.label} | ${fmt(c.v0)} | ${fmt(c.v15)} | +${fmt(((c.v15 - c.v0) / c.v0) * 100, 1)}% | ${fmt(c.v20)} | +${fmt(((c.v20 - c.v0) / c.v0) * 100, 1)}% |`,
  );
}

console.log("\nAGI→회피·크리 (도적·어쌔신):");
console.log("| 시나리오 | 1.0 회피/크리 | ×1.15 | ×1.2 |");
console.log("| --- | ---: | ---: | ---: |");
const agi_cases = [
  {
    label: "도적 lv 50",
    a0: calcPrimary("rogue", 50, c10),
    a15: calcPrimary("rogue", 50, c2_15),
    a20: calcPrimary("rogue", 50, c2_20),
  },
  {
    label: "도적 lv 100",
    a0: calcPrimary("rogue", 100, c10),
    a15: calcPrimary("rogue", 100, c2_15),
    a20: calcPrimary("rogue", 100, c2_20),
  },
  {
    label: "어쌔신 lv 150",
    a0: calcAdvanced("assassin", 150, c10),
    a15: calcAdvanced("assassin", 150, c2_15),
    a20: calcAdvanced("assassin", 150, c2_20),
  },
];
for (const c of agi_cases) {
  console.log(
    `| ${c.label} | ${fmt(c.a0.dodgePct, 1)}%/${fmt(c.a0.agiCritPct, 1)}% | ${fmt(c.a15.dodgePct, 1)}%/${fmt(c.a15.agiCritPct, 1)}% | ${fmt(c.a20.dodgePct, 1)}%/${fmt(c.a20.agiCritPct, 1)}% |`,
  );
}

console.log("\n\n=== #3: vitToHp 절대값 — 2 vs 3 ===\n");
console.log("HP 변동 (장비 0)\n");

const c3_2: Coeff = { ...baseline, vitToHp: 2 };
const c3_3: Coeff = { ...baseline, vitToHp: 3 };

console.log("| 시나리오 | 1.0 (현재) | vitToHp=2 | %증감 | vitToHp=3 | %증감 |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
const hp_cases = [
  {
    label: "전사 lv 50",
    v0: calcPrimary("warrior", 50, c10).hp,
    v2: calcPrimary("warrior", 50, c3_2).hp,
    v3: calcPrimary("warrior", 50, c3_3).hp,
  },
  {
    label: "전사 lv 100",
    v0: calcPrimary("warrior", 100, c10).hp,
    v2: calcPrimary("warrior", 100, c3_2).hp,
    v3: calcPrimary("warrior", 100, c3_3).hp,
  },
  {
    label: "광전사 lv 150 (HP 성장 0.6배)",
    v0: calcAdvanced("berserker", 150, c10).hp,
    v2: calcAdvanced("berserker", 150, c3_2).hp,
    v3: calcAdvanced("berserker", 150, c3_3).hp,
  },
  {
    label: "방패병 lv 150 (HP 성장 1.05배)",
    v0: calcAdvanced("paladin", 150, c10).hp,
    v2: calcAdvanced("paladin", 150, c3_2).hp,
    v3: calcAdvanced("paladin", 150, c3_3).hp,
  },
];
for (const c of hp_cases) {
  console.log(
    `| ${c.label} | ${fmt(c.v0)} | ${fmt(c.v2)} | +${fmt(((c.v2 - c.v0) / c.v0) * 100, 1)}% | ${fmt(c.v3)} | +${fmt(((c.v3 - c.v0) / c.v0) * 100, 1)}% |`,
  );
}

console.log("\n광전사 매 턴 HP 2% 드레인 영향 (lv 150):");
const ber_2 = calcAdvanced("berserker", 150, c3_2).hp;
const ber_3 = calcAdvanced("berserker", 150, c3_3).hp;
console.log(
  `  vitToHp=2: ${fmt(ber_2)} HP → 매 턴 −${fmt(ber_2 * 0.02, 1)} (50턴 누적 −${fmt(ber_2 * 0.02 * 50, 0)})`,
);
console.log(
  `  vitToHp=3: ${fmt(ber_3)} HP → 매 턴 −${fmt(ber_3 * 0.02, 1)} (50턴 누적 −${fmt(ber_3 * 0.02 * 50, 0)})`,
);
