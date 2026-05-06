import type { ClassPassive, Enemy, Stats } from "../types";
import { SPD_EXTRA_ATTACK_RATE } from "../data";
import { dodgeChance } from "./damage";

export const estimateWinChanceVsEnemy = (
  stats: Stats,
  enemy: Enemy,
  passive: ClassPassive,
): number => {
  const enemyDef =
    passive.kind === "def_pierce" ? Math.floor(enemy.def * (1 - passive.pct)) : enemy.def;
  let pBaseDmg = Math.max(1, stats.atk - enemyDef);
  if (passive.kind === "crit") {
    pBaseDmg = pBaseDmg * (1 + passive.chance * (passive.mult - 1));
  }
  const pAttacks = 1 + Math.min(3, stats.spd * SPD_EXTRA_ATTACK_RATE);
  const enemyDodge = dodgeChance(enemy.agi);
  const pDmgPerTurn = pBaseDmg * pAttacks * (1 - enemyDodge);

  let eBaseDmg = Math.max(1, enemy.atk - stats.def);
  if (passive.kind === "damage_reduction") {
    eBaseDmg = eBaseDmg * (1 - passive.pct);
  }
  const eAttacks = 1 + Math.min(3, enemy.spd * SPD_EXTRA_ATTACK_RATE);
  const pDodgeRate = dodgeChance(stats.agi);
  const eDmgPerTurn = eBaseDmg * eAttacks * (1 - pDodgeRate);

  const turnsToKill = enemy.hp / pDmgPerTurn;
  const turnsToDie = stats.maxHp / eDmgPerTurn;

  if (turnsToKill <= turnsToDie * 0.5) return 1.0;
  if (turnsToKill <= turnsToDie) {
    return 0.7 + (1 - turnsToKill / turnsToDie) * 0.3;
  }
  return Math.max(0, 1 - turnsToKill / turnsToDie);
};

export const estimateWinChanceVsRegion = (
  stats: Stats,
  enemies: Enemy[],
  passive: ClassPassive,
): number => {
  if (enemies.length === 0) return 1;
  const sum = enemies.reduce((acc, e) => acc + estimateWinChanceVsEnemy(stats, e, passive), 0);
  return sum / enemies.length;
};
