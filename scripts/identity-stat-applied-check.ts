/**
 * docs/20 적용 후 검증 — 실제 computeStats 호출로 확정값 확인.
 * 사용: npx tsx scripts/identity-stat-applied-check.ts
 */

import { computeStats } from "../src/lib/game/logic";
import type { Character, CharacterClass, AdvancedClassId } from "../src/lib/game/types";

const baseChar = (cls: CharacterClass, lv: number, adv?: AdvancedClassId): Character => ({
  name: "test",
  level: lv,
  exp: 0,
  skillExp: 0,
  currentClass: cls,
  advancedClass: adv,
  currentHp: 1,
});

const print = (label: string, c: Character) => {
  const s = computeStats(c);
  console.log(
    `${label.padEnd(28)} ATK ${String(Math.floor(s.atk)).padStart(5)}  DEF ${String(Math.floor(s.def)).padStart(5)}  HP ${String(Math.floor(s.maxHp)).padStart(6)}  INT ${String(Math.floor(s.int)).padStart(5)}  AGI ${String(Math.floor(s.agi)).padStart(4)}`,
  );
};

console.log("=== docs/20 적용 후 — 실제 computeStats 결과 ===\n");

console.log("[1차 직업]");
print("전사 lv 1", baseChar("warrior", 1));
print("전사 lv 30", baseChar("warrior", 30));
print("전사 lv 50", baseChar("warrior", 50));
print("전사 lv 100", baseChar("warrior", 100));
console.log();
print("도적 lv 1", baseChar("rogue", 1));
print("도적 lv 50", baseChar("rogue", 50));
print("도적 lv 100", baseChar("rogue", 100));
console.log();
print("마법사 lv 1", baseChar("mage", 1));
print("마법사 lv 50", baseChar("mage", 50));
print("마법사 lv 100", baseChar("mage", 100));

console.log("\n[2차 직업 lv 150]");
print("광전사 (atk×1.05, hp×0.52)", baseChar("warrior", 150, "berserker"));
print("방패병 (hp×1.05, def×1.4, atk×0.55)", baseChar("warrior", 150, "paladin"));
print("어쌔신 (agi×0.95, atk×0.85)", baseChar("rogue", 150, "assassin"));
print("맹독술사 (agi×0.85, int+1.05)", baseChar("rogue", 150, "venom_master"));
print("원소술사 (int×1.1)", baseChar("mage", 150, "elementalist"));

console.log("\n=== 비교 — docs/20 §5 예상치 vs 실제 ===\n");

const w100 = computeStats(baseChar("warrior", 100));
const w100Hp = Math.floor(w100.maxHp);
const w100Atk = Math.floor(w100.atk);
const w100Def = Math.floor(w100.def);
console.log(
  `전사 lv 100 — ATK 343±2 (실제 ${w100Atk}) · DEF 325±2 (실제 ${w100Def}) · HP 1897±5 (실제 ${w100Hp})`,
);

const ber150 = computeStats(baseChar("warrior", 150, "berserker"));
const ber150Hp = Math.floor(ber150.maxHp);
const ber150Atk = Math.floor(ber150.atk);
console.log(
  `광전사 lv 150 — ATK ~523 (실제 ${ber150Atk}, 패시브 후 ×1.45) · HP ~1723 (실제 ${ber150Hp})`,
);

const m100 = computeStats(baseChar("mage", 100));
console.log(`마법사 lv 100 — INT 347±2 (실제 ${Math.floor(m100.int)})`);

const r100 = computeStats(baseChar("rogue", 100));
console.log(`도적 lv 100 — AGI ${Math.floor(r100.agi)} (회피·크리는 헬퍼에서 ×1.2)`);
