import type { ClassDef, ClassPassive, Enemy, Region } from "../types";
import {
  AGI_CRIT_CAP,
  AGI_CRIT_RATE,
  AGI_DODGE_CAP,
  AGI_DODGE_RATE,
  SPD_EXTRA_ATTACK_RATE,
} from "../data";

export const dodgeChance = (agi: number): number =>
  Math.min(AGI_DODGE_CAP, Math.max(0, agi * AGI_DODGE_RATE));

export const agiCritChance = (agi: number): number =>
  Math.min(AGI_CRIT_CAP, Math.max(0, agi * AGI_CRIT_RATE));

// 플레이어 한정 — 직업 정체성 계수(agiDodgeMult/agiCritMult) 적용. 적 사이드는 dodgeChance/agiCritChance를 그대로 사용.
export const playerDodgeChance = (cls: ClassDef, agi: number): number =>
  Math.min(AGI_DODGE_CAP, dodgeChance(agi) * (cls.agiDodgeMult ?? 1));

export const playerAgiCritChance = (cls: ClassDef, agi: number): number =>
  Math.min(AGI_CRIT_CAP, agiCritChance(agi) * (cls.agiCritMult ?? 1));

export const randInt = (min: number, max: number) =>
  Math.floor(min + Math.random() * (max - min + 1));

export const computeAttackCount = (spd: number): number => {
  const cap = 4;
  let attacks = 1;
  let pool = spd * SPD_EXTRA_ATTACK_RATE;
  while (attacks < cap) {
    if (pool >= 1) {
      attacks++;
      pool -= 1;
    } else {
      if (Math.random() < pool) attacks++;
      break;
    }
  }
  return attacks;
};

// 마법/방패 등 비-기본공격 데미지에 적용할 크리 계수.
// computePlayerDamage 외부에서 사용 — 패시브/장비/스킬 보정과 동일한 chance·mult를 사용.
export const rollNonPhysicalCrit = (
  passive: ClassPassive,
  extraCritChance: number,
): { mult: number; crit: boolean } => {
  if (passive.kind === "crit") {
    const totalChance = passive.chance + extraCritChance;
    if (Math.random() < totalChance) return { mult: passive.mult, crit: true };
  } else if (extraCritChance > 0) {
    if (Math.random() < extraCritChance) return { mult: 2, crit: true };
  }
  return { mult: 1, crit: false };
};

export type PlayerAttackOpts = {
  atkBoostPct?: number;
  multiplier?: number;
  guaranteedCritMult?: number;
  damageAmpPct?: number;
  extraCritChance?: number;
  // 추가 DEF 무시 비율 (0~1). 클래스 패시브 def_pierce와 합산
  defPiercePct?: number;
};

// 받침 유무로 주격 조사 선택 ("이"/"가")
export const subjectParticle = (name: string): string => {
  if (!name) return "이";
  const last = name[name.length - 1];
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "이"; // non-Korean → default
  const final = (code - 0xac00) % 28;
  return final === 0 ? "가" : "이";
};

export const computePlayerDamage = (
  pAtk: number,
  enemyDef: number,
  passive: ClassPassive,
  opts: PlayerAttackOpts = {},
  out?: { crit: boolean },
): number => {
  const boostedAtk = pAtk * (1 + (opts.atkBoostPct ?? 0));
  const classPierce = passive.kind === "def_pierce" ? passive.pct : 0;
  const totalPierce = Math.min(1, classPierce + (opts.defPiercePct ?? 0));
  const effectiveDef = totalPierce > 0 ? Math.floor(enemyDef * (1 - totalPierce)) : enemyDef;
  let dmg = Math.max(1, boostedAtk - effectiveDef);
  dmg = dmg * (0.9 + Math.random() * 0.2);
  let crit = false;
  if (opts.guaranteedCritMult) {
    dmg = dmg * opts.guaranteedCritMult;
    crit = true;
  } else if (passive.kind === "crit") {
    const totalChance = passive.chance + (opts.extraCritChance ?? 0);
    if (Math.random() < totalChance) {
      dmg = dmg * passive.mult;
      crit = true;
    }
  } else if (opts.extraCritChance && opts.extraCritChance > 0) {
    // For non-rogue classes with skill-based crit chance, use ×2 default
    if (Math.random() < opts.extraCritChance) {
      dmg = dmg * 2;
      crit = true;
    }
  }
  if (opts.multiplier) dmg = dmg * opts.multiplier;
  if (opts.damageAmpPct) dmg = dmg * (1 + opts.damageAmpPct);
  if (out) out.crit = crit;
  return Math.max(1, Math.floor(dmg));
};

// 마법사 마력구체 — 기본 공격을 INT 기반 마법 데미지로 대체.
// 적 MDEF 그대로 차감 — 마법사 클래스 패시브 def_pierce는 적용하지 않음 (과한 패시브 적층 회피).
// 스킬 기반 defPiercePct(opts)는 유지 — 추후 마법 관통 스킬 도입 시 대비.
// 크리티컬은 굴리지 않음 — magic_damage 효과와 일관성 유지.
export const computePlayerMagicBasicDamage = (
  pInt: number,
  intMult: number,
  enemyMdef: number,
  opts: {
    damageAmpPct?: number;
    magicDmgAmpPct?: number;
    defPiercePct?: number;
  } = {},
): number => {
  const baseDmg = pInt * intMult;
  const skillPierce = Math.min(1, opts.defPiercePct ?? 0);
  const effectiveMdef = skillPierce > 0 ? Math.floor(enemyMdef * (1 - skillPierce)) : enemyMdef;
  let dmg = Math.max(1, baseDmg - effectiveMdef);
  dmg = dmg * (0.9 + Math.random() * 0.2);
  if (opts.damageAmpPct) dmg = dmg * (1 + opts.damageAmpPct);
  if (opts.magicDmgAmpPct) dmg = dmg * (1 + opts.magicDmgAmpPct);
  return Math.max(1, Math.floor(dmg));
};

export const computeEnemyDamage = (
  eAtk: number,
  pDef: number,
  passive: ClassPassive,
  extraReductionPct: number = 0,
): number => {
  let dmg = Math.max(1, eAtk - pDef);
  dmg = Math.floor(dmg * (0.9 + Math.random() * 0.2));
  if (passive.kind === "damage_reduction") {
    dmg = Math.floor(dmg * (1 - passive.pct));
  }
  if (extraReductionPct > 0) {
    dmg = Math.floor(dmg * (1 - extraReductionPct));
  }
  return Math.max(1, dmg);
};

export const pickEnemy = (region: Region): Enemy =>
  region.enemies[Math.floor(Math.random() * region.enemies.length)];
