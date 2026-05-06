import type { AdvancedClassDef, AdvancedClassId, CharacterClass } from "../types";

// 2차 직업 — Lv 100 + 전직 퀘스트 클리어 시 선택 가능
export const ADVANCED_CLASSES: Record<AdvancedClassId, AdvancedClassDef> = {
  berserker: {
    id: "berserker",
    parent: "warrior",
    name: "광전사",
    // hp 0.6 → 0.52: 부모(전사) vitToHp=3 도입 시 광전사 HP 격상비를
    // 전사와 동일한 +20%로 맞추기 위한 보정 (docs/20 §7).
    growMult: { atk: 1.05, hp: 0.52 },
    passive: { kind: "berserker_overdrive", atkPct: 0.45, hpDrainPctPerTurn: 0.02 },
    passiveText: "ATK +45% 상시. 매 턴 최대 HP의 2%를 잃음",
    flavor: "광기에 몸을 맡긴 전사. 멈추지 않는 분노가 자신의 몸까지 갉아먹는다.",
  },
  paladin: {
    id: "paladin",
    parent: "warrior",
    name: "방패병",
    growMult: { hp: 1.05, def: 1.4, atk: 0.55 },
    passive: { kind: "shield_reflect", reductionPct: 0.15, reflectPct: 0.4 },
    passiveText: "받는 데미지 -15%, 피격 시 DEF의 40%만큼 적에게 반사",
    flavor: "두꺼운 방패와 묵직한 갑주의 전사. 받은 일격을 그대로 갚아준다.",
  },
  assassin: {
    id: "assassin",
    parent: "rogue",
    name: "어쌔신",
    growMult: { agi: 0.95, atk: 0.85 },
    passive: { kind: "crit", chance: 0.5, mult: 2.5 },
    passiveText: "크리티컬 50% (×2.5 데미지)",
    flavor: "그림자에서만 살아가는 살수. 한 번의 일격에 모든 것을 건다.",
  },
  venom_master: {
    id: "venom_master",
    parent: "rogue",
    name: "맹독술사",
    growMult: { agi: 0.85 },
    growBonus: { int: 1.05 },
    passive: { kind: "dot_aura", pct: 0.5, stackCapBonus: 2 },
    passiveText: "가하는 도트 데미지 +50%, 독 스택 최대치 +2 (도트는 항상 DEF·MDEF 무시)",
    flavor: "독을 다루는 도적. 시간을 갉아먹는 독으로 적을 천천히 죽인다.",
  },
  elementalist: {
    id: "elementalist",
    parent: "mage",
    name: "원소술사",
    growMult: { int: 1.1, mdef: 0.9 },
    passive: { kind: "magic_amp_with_aura", pct: 0.6, turnStartIntMult: 0.3 },
    passiveText: "마법 데미지 +60%, 매 턴 시작 시 INT×0.3 마력 분출",
    flavor: "원소의 흐름을 몸에 두른 술사. 한순간도 마법이 멈추지 않는다.",
  },
};

export const ADVANCED_CLASS_PARENTS: Record<AdvancedClassId, CharacterClass> = {
  berserker: "warrior",
  paladin: "warrior",
  assassin: "rogue",
  venom_master: "rogue",
  elementalist: "mage",
};
