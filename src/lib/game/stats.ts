import type { Character, Stats } from "./types";
import { ADVANCED_CLASSES, CLASSES } from "./data";
import { getEquipmentBonuses, getSetBonuses } from "./equipment-helpers";
import { getCodexBonus } from "./codex";
import type { MonumentExtra } from "./monument";

export const computeStats = (c: Character, monument?: MonumentExtra): Stats => {
  const cls = CLASSES[c.currentClass];
  const lvBonus = c.level - 1;
  const eq = getEquipmentBonuses(c.equipped);
  const setB = getSetBonuses(c.equipped);
  // 2차 직업의 성장률 배율 (기본 1.0)
  const adv = c.advancedClass ? ADVANCED_CLASSES[c.advancedClass] : null;
  type StatKey = "hp" | "atk" | "def" | "mdef" | "spd" | "agi" | "int" | "str" | "vit" | "matk";
  const m = (k: StatKey): number => adv?.growMult[k] ?? 1;
  const b = (k: StatKey): number => adv?.growBonus?.[k] ?? 0;
  const cx = getCodexBonus(c.codex);
  const mn = monument ?? {};
  // 레벨업 자유 분배 (코덱스와 별개)
  const al = c.allocatedStats;
  const str =
    (cls.baseStr ?? 0) +
    ((cls.growStr ?? 0) * m("str") + b("str")) * lvBonus +
    (eq.str ?? 0) +
    (setB.str ?? 0) +
    cx.str +
    (mn.str ?? 0) +
    (al?.str ?? 0);
  const vit =
    (cls.baseVit ?? 0) +
    ((cls.growVit ?? 0) * m("vit") + b("vit")) * lvBonus +
    (eq.vit ?? 0) +
    (setB.vit ?? 0) +
    cx.vit +
    (mn.vit ?? 0) +
    (al?.vit ?? 0);
  const matk =
    (cls.baseMatk ?? 0) +
    ((cls.growMatk ?? 0) * m("matk") + b("matk")) * lvBonus +
    (eq.matk ?? 0) +
    (setB.matk ?? 0) +
    cx.matk +
    (mn.matk ?? 0);
  // ATK/DEF/INT는 STR/VIT/MATK가 가산된 최종값 반환 (데미지 공식이 그대로 사용)
  // 정체성 자원 변환 계수 (docs/20). 미설정 시 기본 동작 유지.
  const strToAtkMult = cls.strToAtkMult ?? 1;
  const vitToDefMult = cls.vitToDefMult ?? 1;
  const vitToHpFactor = cls.vitToHp ?? 0;
  const matkToIntMult = cls.matkToIntMult ?? 1;
  return {
    maxHp:
      cls.baseHp +
      (cls.growHp * m("hp") + b("hp")) * lvBonus +
      (eq.hp ?? 0) +
      (setB.hp ?? 0) +
      cx.hp +
      (mn.hp ?? 0) +
      vit * vitToHpFactor,
    atk:
      cls.baseAtk +
      (cls.growAtk * m("atk") + b("atk")) * lvBonus +
      (eq.atk ?? 0) +
      (setB.atk ?? 0) +
      (mn.atk ?? 0) +
      str * strToAtkMult,
    def:
      cls.baseDef +
      (cls.growDef * m("def") + b("def")) * lvBonus +
      (eq.def ?? 0) +
      (setB.def ?? 0) +
      (mn.def ?? 0) +
      vit * vitToDefMult,
    mdef:
      cls.baseMdef +
      (cls.growMdef * m("mdef") + b("mdef")) * lvBonus +
      (eq.mdef ?? 0) +
      (setB.mdef ?? 0) +
      cx.mdef +
      (mn.mdef ?? 0),
    spd:
      cls.baseSpd +
      (cls.growSpd * m("spd") + b("spd")) * lvBonus +
      (eq.spd ?? 0) +
      (setB.spd ?? 0) +
      cx.spd +
      (mn.spd ?? 0),
    agi:
      cls.baseAgi +
      (cls.growAgi * m("agi") + b("agi")) * lvBonus +
      (eq.agi ?? 0) +
      (setB.agi ?? 0) +
      cx.agi +
      (mn.agi ?? 0) +
      (al?.agi ?? 0),
    int:
      cls.baseInt +
      (cls.growInt * m("int") + b("int")) * lvBonus +
      (eq.int ?? 0) +
      (setB.int ?? 0) +
      (mn.int ?? 0) +
      matk * matkToIntMult +
      (al?.int ?? 0),
    str,
    vit,
    matk,
  };
};
