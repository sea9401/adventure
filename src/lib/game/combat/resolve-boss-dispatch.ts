import {
  AGI_DODGE_CAP,
  BOSS_DURATION_SEC,
  BOSS_REWARD_MULT,
  CLASSES,
  DOT_BASE_INT_MULT,
  DOT_STACK_CAP,
  TEST_REWARD_MULT,
} from "../data";
import type {
  BossCombatLogEntry,
  BossDispatchResult,
  Character,
  EquipmentId,
  Guild,
  Materials,
  Region,
  Resources,
  SkillId,
} from "../types";

import { getEquipmentCritBonus, getEquipmentDotAmp } from "../equipment-helpers";
import { getActiveClassName, getActivePassive, getEquippedSkills } from "../skills";
import { computeStats } from "../stats";
import {
  comboName,
  consumeStacksForCombo,
  currentElementBuff,
  initElementState,
  lookupComboEffect,
  pickCombo,
  pushElementStack,
  tickElementLinger,
} from "./element";
import {
  computeAttackCount,
  computeEnemyDamage,
  computePlayerDamage,
  computePlayerMagicBasicDamage,
  dodgeChance,
  playerAgiCritChance,
  playerDodgeChance,
  rollNonPhysicalCrit,
  subjectParticle,
} from "./damage";
import type { MonumentExtra } from "../monument";

export const resolveBossDispatch = (
  character: Character,
  region: Region,
  guild: Guild,
  monumentBonus?: MonumentExtra,
): BossDispatchResult => {
  const baseStats = computeStats(character, monumentBonus);
  const stats = { ...baseStats };
  const passive = getActivePassive(character);
  const className = getActiveClassName(character);
  const cls = CLASSES[character.currentClass];
  const boss = region.boss!;
  let pHp = character.currentHp;
  let playerShield = 0; // 얼음 방패 등 — 받는 데미지 우선 흡수, 소진 시까지 지속
  let bHp = boss.hp;
  let timeLeft = BOSS_DURATION_SEC;

  let totalDmgDealt = 0;
  let maxSingleHit = 0;
  let totalDmgTaken = 0;
  let totalTurns = 0;
  let dodgesByPlayer = 0;
  let dodgesByEnemy = 0;
  let executeHitCount = 0;
  const log: BossCombatLogEntry[] = [];

  const equippedSkills = getEquippedSkills(character);
  const skillActivations: Partial<Record<SkillId, number>> = {};
  const cooldowns: Partial<Record<SkillId, number>> = {};
  for (const s of equippedSkills) {
    if (s.trigger.kind === "every_n_turns") cooldowns[s.id] = s.trigger.n;
  }
  let atkBoostPct = 0;
  let dodgeBoostFlat = 0;
  let damageAmpPct = 0;
  let dmgReductionPct = 0;
  let extraCritChance = 0;
  let magicDmgAmpPct = 0;
  // 신규 (B1)
  let healPerTurnPct = 0;
  let lifestealMagicPct = 0;
  let condHpBelowThreshold = 0;
  let condHpBelowAtkPct = 0;
  let condHpBelowDmgAmpPct = 0;
  let condHpBelowSpdFlat = 0;
  let thornAuraDefMult = 0;
  let followUpStrikePct = 0;
  let executeEveryHits = 0;
  let executeMaxHpPct = 0;
  let dotOnHitStacks = 0;
  let magicBasicIntMult = 0; // 마법사 마력구체 패시브 — 기본 공격을 INT × intMult 마법 데미지로 대체
  let condensationEveryN = 0; // 마력 환류 — 마법 N회 시전마다 다음 마법 +bonusPct
  let condensationBonusPct = 0;
  // 신규 (B2)
  let lifestealPhysicalPct = 0;
  let counterAttacksPerDodge = 0;
  let dodgeNextHitMult = 0;
  let reviveTriggerHpPct = 0;
  let reviveRestoreHpPct = 0;
  let extraDefPiercePct = 0;
  let skillTurnStartIntMult = 0;
  let dotAmpPct = 0;
  let dotStackCap = DOT_STACK_CAP;
  let condVsBossAtkPct = 0;
  let condVsBossDmgAmpPct = 0;
  let flatAtk = 0,
    flatDef = 0,
    flatMdef = 0,
    flatSpd = 0,
    flatAgi = 0,
    flatInt = 0,
    flatHp = 0;
  let pctAtk = 0,
    pctDef = 0,
    pctMdef = 0,
    pctSpd = 0,
    pctAgi = 0,
    pctInt = 0,
    pctHp = 0;
  let flatDodgePct = 0;
  let shieldReflectPct = 0;
  for (const s of equippedSkills) {
    if (s.trigger.kind !== "passive") continue;
    if (s.effect.kind === "atk_boost") atkBoostPct += s.effect.pct;
    if (s.effect.kind === "dodge_boost") dodgeBoostFlat += s.effect.flat;
    if (s.effect.kind === "dot_amp") dotAmpPct += s.effect.pct;
    if (s.effect.kind === "damage_amplify") damageAmpPct += s.effect.pct;
    if (s.effect.kind === "damage_reduction") dmgReductionPct += s.effect.pct;
    if (s.effect.kind === "reflect_on_hit") shieldReflectPct += s.effect.defMult;
    if (s.effect.kind === "crit_chance_boost") extraCritChance += s.effect.chance;
    if (s.effect.kind === "magic_damage_amp") magicDmgAmpPct += s.effect.pct;
    if (s.effect.kind === "heal_per_turn") healPerTurnPct += s.effect.pct;
    if (s.effect.kind === "lifesteal") {
      if (s.effect.source === "magic") lifestealMagicPct += s.effect.pct;
      else lifestealPhysicalPct += s.effect.pct;
    }
    if (s.effect.kind === "conditional_modifier") {
      if (s.effect.trigger === "hp_below_pct") {
        condHpBelowThreshold = Math.max(condHpBelowThreshold, s.effect.threshold ?? 0.5);
        condHpBelowAtkPct += s.effect.atkPct ?? 0;
        condHpBelowDmgAmpPct += s.effect.dmgAmpPct ?? 0;
        condHpBelowSpdFlat += s.effect.spdFlat ?? 0;
      } else if (s.effect.trigger === "vs_boss") {
        condVsBossAtkPct += s.effect.atkPct ?? 0;
        condVsBossDmgAmpPct += s.effect.dmgAmpPct ?? 0;
      }
    }
    if (s.effect.kind === "thorn_aura") thornAuraDefMult += s.effect.defMult;
    if (s.effect.kind === "follow_up_attack") followUpStrikePct += s.effect.pct;
    if (s.effect.kind === "execute_on_hits") {
      executeEveryHits = s.effect.hits;
      executeMaxHpPct = Math.max(executeMaxHpPct, s.effect.maxHpPct);
    }
    if (s.effect.kind === "dot_on_hit") dotOnHitStacks += s.effect.stacks;
    if (s.effect.kind === "magic_basic_attack")
      magicBasicIntMult = Math.max(magicBasicIntMult, s.effect.intMult);
    if (s.effect.kind === "magic_condensation") {
      condensationEveryN = s.effect.everyN;
      condensationBonusPct = s.effect.bonusPct;
    }
    if (s.effect.kind === "dodge_reaction") {
      if (s.effect.reactionType === "counter_attack") counterAttacksPerDodge += s.effect.value;
      else dodgeNextHitMult = Math.max(dodgeNextHitMult, s.effect.value);
      dodgeBoostFlat += s.effect.dodgeFlat ?? 0;
    }
    if (s.effect.kind === "revive_once") {
      reviveTriggerHpPct = Math.max(reviveTriggerHpPct, s.effect.triggerHpPct);
      reviveRestoreHpPct = Math.max(reviveRestoreHpPct, s.effect.restoreHpPct);
    }
    if (s.effect.kind === "def_pierce") extraDefPiercePct += s.effect.pct;
    if (s.effect.kind === "turn_start_magic") skillTurnStartIntMult += s.effect.intMult;
    if (s.effect.kind === "flat_stat") {
      flatAtk += s.effect.atk ?? 0;
      flatDef += s.effect.def ?? 0;
      flatMdef += s.effect.mdef ?? 0;
      flatSpd += s.effect.spd ?? 0;
      flatAgi += s.effect.agi ?? 0;
      flatInt += s.effect.int ?? 0;
      flatHp += s.effect.hp ?? 0;
      flatDodgePct += s.effect.dodgePct ?? 0;
    }
    if (s.effect.kind === "stat_pct_boost") {
      pctAtk += s.effect.atkPct ?? 0;
      pctDef += s.effect.defPct ?? 0;
      pctMdef += s.effect.mdefPct ?? 0;
      pctSpd += s.effect.spdPct ?? 0;
      pctAgi += s.effect.agiPct ?? 0;
      pctInt += s.effect.intPct ?? 0;
      pctHp += s.effect.hpPct ?? 0;
    }
  }
  // class passive
  let berserkerAtkPct = 0;
  let berserkerHpDrainPct = 0;
  let speedAuraEnemy = 0;
  let auraTurnStartIntMult = 0;
  if (passive.kind === "berserker_overdrive") {
    berserkerAtkPct = passive.atkPct;
    berserkerHpDrainPct = passive.hpDrainPctPerTurn;
  } else if (passive.kind === "shield_reflect") {
    dmgReductionPct += passive.reductionPct;
    shieldReflectPct += passive.reflectPct;
  } else if (passive.kind === "speed_aura") {
    flatSpd += passive.spdSelfBonus;
    speedAuraEnemy = passive.enemySpdDebuff;
  } else if (passive.kind === "magic_amp_with_aura") {
    magicDmgAmpPct += passive.pct;
    auraTurnStartIntMult = passive.turnStartIntMult;
  } else if (passive.kind === "dot_aura") {
    dotAmpPct += passive.pct;
    dotStackCap += passive.stackCapBonus ?? 0;
  }
  dotAmpPct += getEquipmentDotAmp(character.equipped);
  stats.atk += flatAtk;
  stats.def += flatDef;
  stats.mdef += flatMdef;
  stats.spd += flatSpd;
  stats.agi += flatAgi;
  stats.int += flatInt;
  stats.maxHp += flatHp;
  if (pctAtk) stats.atk = Math.floor(stats.atk * (1 + pctAtk));
  if (pctDef) stats.def = Math.floor(stats.def * (1 + pctDef));
  if (pctMdef) stats.mdef = Math.floor(stats.mdef * (1 + pctMdef));
  if (pctSpd) stats.spd = Math.floor(stats.spd * (1 + pctSpd));
  if (pctAgi) stats.agi = Math.floor(stats.agi * (1 + pctAgi));
  if (pctInt) stats.int = Math.floor(stats.int * (1 + pctInt));
  if (pctHp) stats.maxHp = Math.floor(stats.maxHp * (1 + pctHp));
  extraCritChance +=
    playerAgiCritChance(cls, stats.agi) + getEquipmentCritBonus(character.equipped);
  // vs_boss 조건은 이 resolver에서 항상 true (보스 전용)
  const baseAtkBoostPct = atkBoostPct + condVsBossAtkPct;
  const baseDmgAmpPct = damageAmpPct + condVsBossDmgAmpPct;
  const totalTurnStartIntMult = skillTurnStartIntMult + auraTurnStartIntMult;
  const playerDodge = Math.min(
    AGI_DODGE_CAP,
    playerDodgeChance(cls, stats.agi) + dodgeBoostFlat + flatDodgePct,
  );
  let stunnedTurns = 0;
  let pendingNextHitMult = 0;
  let reviveAvailable = reviveRestoreHpPct > 0;
  let selfAtkBuffPct = 0;
  let selfAtkBuffTurnsLeft = 0;
  let reflectBoostPct = 0;
  let reflectBoostTurnsLeft = 0;
  let bossAtkDebuffPct = 0;
  let bossAtkDebuffTurns = 0;
  let bossDefDebuffPct = 0;
  let bossDefDebuffTurns = 0;

  // Boss skill state
  let bossSkillCD = 0;
  let bossNextAttackMult = 1;
  let bossAtkBoostTurnsLeft = 0;
  let bossAtkBoostPct = 0;
  let bossDefBoostTurnsLeft = 0;
  let bossDefBoostPct = 0;
  let dotTurnsLeft = 0;
  let dotPctPerTurn = 0;
  let spdDebuffTurnsLeft = 0;
  let spdDebuffAmount = 0;
  // Player-applied debuff to boss (frost_bind)
  let bossSpdDebuffTurns = 0;
  let bossSpdDebuffAmount = 0;
  // Player-applied DOT to boss
  let bossDotStacks = 0;
  let dotLingerTurnsLeft = 0;
  let dotLingerPerTurn = 0;
  let dotAmpBoostTurnsLeft = 0;
  let dotAmpBoostPct = 0;
  // 원소술사 — 전투 한정 스택/잔존 (24 plan)
  const elementState = initElementState();
  let comboSelfSpdFlat = 0;
  let comboSelfMdefPctBuff = 0;
  let comboSelfBuffTurnsLeft = 0;
  // 마력 환류 — 전투 한정 카운터 (턴 사이 보존)
  let magicCastCounter = 0;
  let condensationActive = false;

  while (timeLeft > 0 && pHp > 0 && bHp > 0) {
    totalTurns++;
    const turnEvents: string[] = [];
    let triggeredTauntExtra = 0;
    // 원소술사 — 매 턴 시작 시 잔존 카운트 + 콤보 selfBuff 카운트 감소
    tickElementLinger(elementState);
    if (comboSelfBuffTurnsLeft > 0) {
      comboSelfBuffTurnsLeft -= 1;
      if (comboSelfBuffTurnsLeft === 0) {
        comboSelfSpdFlat = 0;
        comboSelfMdefPctBuff = 0;
      }
    }
    const elemBuff = currentElementBuff(elementState);
    const elemIntMult = 1 + (elemBuff.intPct ?? 0);
    const elemDefMult = 1 + (elemBuff.defPct ?? 0);
    const elemSpdFlat = (elemBuff.spdFlat ?? 0) + comboSelfSpdFlat;
    const elemDmgReduction = elemBuff.dmgReductionPct ?? 0;
    const elemMagicCrit = elemBuff.magicCritChance ?? 0;
    const elemTurnStartMult = 1 + (elemBuff.turnStartMagicMult ?? 0);
    const playerEffInt = Math.floor(stats.int * elemIntMult);
    const playerEffDef = Math.floor(stats.def * elemDefMult);
    void comboSelfMdefPctBuff; // 보스가 player MDEF에 직접 데미지 가하는 경로 없음

    // Boss skill activation
    if (boss.skill) {
      bossSkillCD++;
      if (bossSkillCD >= boss.skill.cooldown) {
        bossSkillCD = 0;
        const eff = boss.skill.effect;
        if (eff.kind === "flat_damage") {
          const rawDmg = Math.max(1, Math.floor(boss.atk * eff.atkMult));
          let dmg = rawDmg;
          if (playerShield > 0 && dmg > 0) {
            const absorbed = Math.min(playerShield, dmg);
            playerShield -= absorbed;
            dmg -= absorbed;
            if (absorbed > 0) turnEvents.push(`🛡 −${absorbed}`);
          }
          pHp -= dmg;
          totalDmgTaken += dmg;
          turnEvents.push(`☠ ${boss.name}의 ${boss.skill.name}! ${rawDmg}의 피해를 입혔다!`);
        } else {
          turnEvents.push(`☠ ${boss.name}의 ${boss.skill.name}!`);
        }
        if (eff.kind === "self_heal") {
          const heal = Math.floor(boss.hp * eff.pct);
          bHp = Math.min(boss.hp, bHp + heal);
        } else if (eff.kind === "next_attack_mult") {
          bossNextAttackMult = eff.mult;
        } else if (eff.kind === "atk_boost") {
          bossAtkBoostTurnsLeft = eff.turns;
          bossAtkBoostPct = eff.pct;
        } else if (eff.kind === "def_boost") {
          bossDefBoostTurnsLeft = eff.turns;
          bossDefBoostPct = eff.pct;
        } else if (eff.kind === "dot_pct") {
          dotTurnsLeft = eff.turns;
          dotPctPerTurn = eff.pct;
        } else if (eff.kind === "spd_debuff") {
          spdDebuffTurnsLeft = eff.turns;
          spdDebuffAmount = eff.amount;
        }
      }
    }

    // 조건부 buff (HP 임계 + missing_hp_atk — 매 턴 재평가)
    const hpRatio = stats.maxHp > 0 ? pHp / stats.maxHp : 1;
    const isLowHp = hpRatio <= condHpBelowThreshold;
    let turnAtkBoostPct = baseAtkBoostPct + (isLowHp ? condHpBelowAtkPct : 0);
    const turnDmgAmpPct = baseDmgAmpPct + (isLowHp ? condHpBelowDmgAmpPct : 0);
    if (berserkerAtkPct > 0) {
      turnAtkBoostPct += berserkerAtkPct;
    }
    if (selfAtkBuffTurnsLeft > 0) {
      turnAtkBoostPct += selfAtkBuffPct;
    }
    if (berserkerHpDrainPct > 0 && pHp > 0) {
      pHp = Math.max(1, pHp - stats.maxHp * berserkerHpDrainPct);
    }
    // 원소술사 패시브 (마력 분출) + turn_start_magic 스킬
    if (totalTurnStartIntMult > 0 && bHp > 0) {
      const effBossMdef = Math.floor(
        boss.mdef * (1 + (bossDefBoostTurnsLeft > 0 ? bossDefBoostPct : 0)),
      );
      const dmg = Math.max(
        1,
        Math.floor(playerEffInt * totalTurnStartIntMult * elemTurnStartMult) - effBossMdef,
      );
      const finalDmg = Math.floor(dmg * (1 + turnDmgAmpPct) * (1 + magicDmgAmpPct));
      bHp -= finalDmg;
      totalDmgDealt += finalDmg;
      turnEvents.push(`🌪 마력 분출 ${finalDmg}`);
    }

    // 행동 슬롯 계산 (SPD 기반). 액티브 스킬 발동은 슬롯을 소모.
    const effectiveSpd =
      Math.max(0, stats.spd - (spdDebuffTurnsLeft > 0 ? spdDebuffAmount : 0)) +
      (isLowHp ? condHpBelowSpdFlat : 0) +
      elemSpdFlat;
    const totalSlots = computeAttackCount(effectiveSpd);

    // 선공 결정: SPD 비교 (동률은 플레이어 우선)
    const bossEffectiveSpdForOrder = Math.max(
      0,
      boss.spd - (bossSpdDebuffTurns > 0 ? bossSpdDebuffAmount : 0) - speedAuraEnemy,
    );
    const playerFirst = effectiveSpd >= bossEffectiveSpdForOrder;
    let bossHandled = false;

    // 보스 행동 페이즈 (선공 여부에 따라 호출 시점 달라짐)
    const runBossPhase = () => {
      let pendingCounters = 0;
      if (stunnedTurns > 0) {
        stunnedTurns--;
      } else {
        const effectiveBossSpd = Math.max(
          0,
          boss.spd - (bossSpdDebuffTurns > 0 ? bossSpdDebuffAmount : 0) - speedAuraEnemy,
        );
        const eAttacks = computeAttackCount(effectiveBossSpd) + triggeredTauntExtra;
        let effectiveBossAtk = Math.floor(
          boss.atk * (1 + (bossAtkBoostTurnsLeft > 0 ? bossAtkBoostPct : 0)),
        );
        if (bossAtkDebuffTurns > 0) {
          effectiveBossAtk = Math.floor(effectiveBossAtk * (1 - bossAtkDebuffPct));
        }
        let reflectHits = 0;
        const enemyAttackEvents: string[] = [];
        const charName = character.name?.trim() || "모험가";
        const charParticle = subjectParticle(charName);
        if (eAttacks > 0) {
          enemyAttackEvents.push(`☠ ${boss.name}의 ${eAttacks}회 공격!`);
        }
        for (let i = 0; i < eAttacks; i++) {
          if (Math.random() < playerDodge) {
            dodgesByPlayer++;
            if (counterAttacksPerDodge > 0) pendingCounters += counterAttacksPerDodge;
            if (dodgeNextHitMult > 1) pendingNextHitMult = dodgeNextHitMult;
            enemyAttackEvents.push(`☠ ${charName}${charParticle} 피했다!`);
            continue;
          }
          let dmg = computeEnemyDamage(
            effectiveBossAtk,
            playerEffDef,
            passive,
            dmgReductionPct + elemDmgReduction,
          );
          if (i === 0 && bossNextAttackMult > 1) {
            dmg = Math.floor(dmg * bossNextAttackMult);
            bossNextAttackMult = 1;
          }
          const rawHit = dmg;
          if (playerShield > 0 && dmg > 0) {
            const absorbed = Math.min(playerShield, dmg);
            playerShield -= absorbed;
            dmg -= absorbed;
            if (absorbed > 0) enemyAttackEvents.push(`🛡 흡수 ${absorbed}`);
          }
          pHp -= dmg;
          totalDmgTaken += dmg;
          reflectHits++;
          enemyAttackEvents.push(`☠ 공격! ${rawHit}의 피해를 입혔다!`);
          if (pHp <= 0) break;
        }
        for (const ev of enemyAttackEvents) turnEvents.push(ev);
        if (shieldReflectPct > 0 && reflectHits > 0 && bHp > 0) {
          const effectiveReflectPct =
            shieldReflectPct + (reflectBoostTurnsLeft > 0 ? reflectBoostPct : 0);
          const reflectPerHit = Math.max(1, Math.floor(playerEffDef * effectiveReflectPct));
          const totalReflect = reflectPerHit * reflectHits;
          bHp -= totalReflect;
          totalDmgDealt += totalReflect;
          if (totalReflect > maxSingleHit) maxSingleHit = totalReflect;
          turnEvents.push(`⚡ 반사 ${totalReflect}`);
        }
      }
      // 무영각 카운터
      if (pendingCounters > 0 && bHp > 0) {
        let counterDmg = 0;
        const effDef =
          bossDefDebuffTurns > 0
            ? Math.floor(
                boss.def *
                  (1 + (bossDefBoostTurnsLeft > 0 ? bossDefBoostPct : 0)) *
                  (1 - bossDefDebuffPct),
              )
            : Math.floor(boss.def * (1 + (bossDefBoostTurnsLeft > 0 ? bossDefBoostPct : 0)));
        for (let c = 0; c < pendingCounters; c++) {
          if (Math.random() < dodgeChance(boss.agi)) {
            dodgesByEnemy++;
            continue;
          }
          const dmg =
            magicBasicIntMult > 0
              ? computePlayerMagicBasicDamage(playerEffInt, magicBasicIntMult, boss.mdef, {
                  damageAmpPct: turnDmgAmpPct,
                  magicDmgAmpPct,
                  defPiercePct: extraDefPiercePct,
                })
              : computePlayerDamage(stats.atk, effDef, passive, {
                  atkBoostPct: turnAtkBoostPct,
                  damageAmpPct: turnDmgAmpPct,
                  extraCritChance,
                  defPiercePct: extraDefPiercePct,
                });
          bHp -= dmg;
          totalDmgDealt += dmg;
          counterDmg += dmg;
          if (bHp <= 0) break;
        }
        if (counterDmg > 0) turnEvents.push(`🔁 카운터 ${counterDmg}`);
      }
      // 순교
      if (reviveAvailable && stats.maxHp > 0 && pHp / stats.maxHp <= reviveTriggerHpPct) {
        pHp = Math.max(pHp, Math.floor(stats.maxHp * reviveRestoreHpPct));
        reviveAvailable = false;
        turnEvents.push(`✨ 순교 발동`);
      }
    };

    // 보스가 더 빠르면 먼저 행동
    if (!playerFirst) {
      runBossPhase();
      bossHandled = true;
      if (pHp <= 0) {
        log.push({
          turn: totalTurns,
          text: turnEvents.join(" · "),
          playerHpAfter: 0,
          bossHpAfter: Math.max(0, Math.floor(bHp)),
          elements: [...elementState.stacks],
          elementLingerTurns: elementState.lingerTurnsLeft,
        });
        break;
      }
      if (bHp <= 0) {
        // 반사로 보스 처치
        log.push({
          turn: totalTurns,
          text: turnEvents.join(" · "),
          playerHpAfter: Math.floor(pHp),
          bossHpAfter: 0,
          elements: [...elementState.stacks],
          elementLingerTurns: elementState.lingerTurnsLeft,
        });
        break;
      }
    }

    const damageSkillHits: {
      mult: number;
      defPiercePct: number;
      name: string;
      flatBonus: number;
    }[] = [];
    let shieldFireSelfHpCostSum = 0;
    let stunOnFire = 0;
    let critMult: number | undefined;
    let fireballDmg = 0;
    let shieldStrikeDmg = 0;
    let shieldStrikeName: string | undefined;
    const magicSkillNames: string[] = [];
    let bonusAttacks = 0;
    let bonusAttacksWithCrit = 0;
    const frostStun = 0;
    let pendingBossDotStacks = 0;
    let burstIntMultThisTurn = 0;
    let triggeredSelfHealPct = 0;
    let triggeredBossAtkDebuffPct = 0;
    let triggeredBossAtkDebuffTurns = 0;
    let triggeredBossDefDebuffPct = 0;
    let triggeredBossDefDebuffTurns = 0;
    let triggeredHpPctDmg = 0;

    // 1) 모든 액티브 쿨다운 tick
    for (const s of equippedSkills) {
      if (s.trigger.kind === "every_n_turns") {
        cooldowns[s.id] = (cooldowns[s.id] ?? 0) + 1;
      }
    }
    // 2) 준비된 스킬 → 사용자 장착 순서 → 슬롯만큼만 발동
    const readySkills = equippedSkills.filter(
      (s) =>
        s.trigger.kind === "every_n_turns" &&
        (cooldowns[s.id] ?? 0) >= (s.trigger.kind === "every_n_turns" ? s.trigger.n : 0),
    );
    const skillsToFire = readySkills.slice(0, totalSlots);
    // 비-데미지 스킬(버프/디버프/회복 등) 발동 로그는 공격 헤더·데미지 라인 뒤로 미룸.
    // 데미지 스킬은 hit 라인에 발동 정보가 합쳐 표기되므로 별도 처리 안 함.
    const pendingBuffLogs: string[] = [];

    for (const s of skillsToFire) {
      cooldowns[s.id] = 0;
      skillActivations[s.id] = (skillActivations[s.id] ?? 0) + 1;
      const damageKinds = [
        "extra_damage_with_stun",
        "magic_damage",
        "magic_damage_with_spd_debuff",
        "shield_strike",
      ];
      if (!damageKinds.includes(s.effect.kind)) {
        pendingBuffLogs.push(`⚡ ${s.name} 발동`);
        if (s.description) pendingBuffLogs.push(`↳ ${s.description}`);
      }
      {
        if (s.effect.kind === "extra_damage_with_stun") {
          const hpCost = s.effect.selfHpCostPct ?? 0;
          const flatBonus = s.effect.addHpCostAsDamage ? Math.floor(stats.maxHp * hpCost) : 0;
          damageSkillHits.push({
            mult: s.effect.mult,
            defPiercePct: s.effect.defPiercePct ?? 0,
            name: s.name,
            flatBonus,
          });
          stunOnFire = Math.max(stunOnFire, s.effect.stunTurns);
          shieldFireSelfHpCostSum += hpCost;
        } else if (s.effect.kind === "guaranteed_crit") {
          critMult = s.effect.mult;
        } else if (s.effect.kind === "magic_damage") {
          const hits = s.effect.hits ?? 1;
          const effectiveMdef = s.effect.ignoreMdef
            ? 0
            : Math.floor(boss.mdef * (1 + (bossDefBoostTurnsLeft > 0 ? bossDefBoostPct : 0)));
          const baseHit = Math.max(1, Math.floor(playerEffInt * s.effect.intMult) - effectiveMdef);
          let castMult = 1;
          if (condensationActive) {
            castMult = 1 + condensationBonusPct;
            condensationActive = false;
            pendingBuffLogs.push(`✨ 마력 환류 폭발! +${(condensationBonusPct * 100).toFixed(0)}%`);
          }
          for (let i = 0; i < hits; i++) {
            const c = rollNonPhysicalCrit(passive, extraCritChance + elemMagicCrit);
            fireballDmg += Math.floor(baseHit * c.mult * castMult);
          }
          if (s.effect.dotStacks) pendingBossDotStacks += s.effect.dotStacks;
          magicSkillNames.push(s.name);
          magicCastCounter++;
          if (condensationEveryN > 0 && magicCastCounter >= condensationEveryN) {
            condensationActive = true;
            magicCastCounter = 0;
          }
        } else if (s.effect.kind === "magic_damage_with_spd_debuff") {
          const effectiveMdef = Math.floor(
            boss.mdef * (1 + (bossDefBoostTurnsLeft > 0 ? bossDefBoostPct : 0)),
          );
          const baseHit = Math.max(1, Math.floor(playerEffInt * s.effect.intMult) - effectiveMdef);
          let castMult = 1;
          if (condensationActive) {
            castMult = 1 + condensationBonusPct;
            condensationActive = false;
            pendingBuffLogs.push(`✨ 마력 환류 폭발! +${(condensationBonusPct * 100).toFixed(0)}%`);
          }
          const c = rollNonPhysicalCrit(passive, extraCritChance + elemMagicCrit);
          fireballDmg += Math.floor(baseHit * c.mult * castMult);
          bossSpdDebuffTurns = Math.max(bossSpdDebuffTurns, s.effect.spdTurns);
          bossSpdDebuffAmount = Math.max(bossSpdDebuffAmount, s.effect.spdAmount);
          magicSkillNames.push(s.name);
          magicCastCounter++;
          if (condensationEveryN > 0 && magicCastCounter >= condensationEveryN) {
            condensationActive = true;
            magicCastCounter = 0;
          }
        } else if (s.effect.kind === "apply_element") {
          pushElementStack(elementState, s.effect.element);
          if (s.effect.enemyDebuff?.stat === "spd") {
            bossSpdDebuffTurns = Math.max(bossSpdDebuffTurns, s.effect.enemyDebuff.turns);
            bossSpdDebuffAmount = Math.max(bossSpdDebuffAmount, -s.effect.enemyDebuff.flat);
          }
          magicSkillNames.push(s.name);
        } else if (s.effect.kind === "elemental_combo") {
          const combo = pickCombo(elementState.stacks);
          if (combo) {
            const ce = lookupComboEffect(combo, [...elementState.stacks]);
            const effectiveMdef = ce.ignoreMdef
              ? 0
              : Math.floor(boss.mdef * (1 + (bossDefBoostTurnsLeft > 0 ? bossDefBoostPct : 0)));
            const baseHit = Math.max(1, Math.floor(playerEffInt * ce.intMult) - effectiveMdef);
            const hits = ce.hits ?? 1;
            let castMult = 1;
            if (condensationActive) {
              castMult = 1 + condensationBonusPct;
              condensationActive = false;
              pendingBuffLogs.push(
                `✨ 마력 환류 폭발! +${(condensationBonusPct * 100).toFixed(0)}%`,
              );
            }
            for (let i = 0; i < hits; i++) {
              const c = rollNonPhysicalCrit(passive, extraCritChance + elemMagicCrit);
              fireballDmg += Math.floor(baseHit * c.mult * castMult);
            }
            magicCastCounter++;
            if (condensationEveryN > 0 && magicCastCounter >= condensationEveryN) {
              condensationActive = true;
              magicCastCounter = 0;
            }
            if (ce.dotStacks) pendingBossDotStacks += ce.dotStacks;
            if (ce.enemySpdZeroTurns) {
              bossSpdDebuffTurns = Math.max(bossSpdDebuffTurns, ce.enemySpdZeroTurns);
              bossSpdDebuffAmount = Math.max(bossSpdDebuffAmount, boss.spd);
            }
            if (ce.enemySpdDebuff && ce.enemyDebuffTurns) {
              bossSpdDebuffTurns = Math.max(bossSpdDebuffTurns, ce.enemyDebuffTurns);
              bossSpdDebuffAmount = Math.max(bossSpdDebuffAmount, ce.enemySpdDebuff);
            }
            if (ce.enemyDefMdefDebuffPct && ce.enemyDebuffTurns) {
              triggeredBossDefDebuffPct = Math.max(
                triggeredBossDefDebuffPct,
                ce.enemyDefMdefDebuffPct,
              );
              triggeredBossDefDebuffTurns = Math.max(
                triggeredBossDefDebuffTurns,
                ce.enemyDebuffTurns,
              );
            }
            if (ce.selfBuffTurns) {
              comboSelfSpdFlat = Math.max(comboSelfSpdFlat, ce.selfSpdBuff ?? 0);
              comboSelfMdefPctBuff = Math.max(comboSelfMdefPctBuff, ce.selfMdefBuffPct ?? 0);
              comboSelfBuffTurnsLeft = Math.max(comboSelfBuffTurnsLeft, ce.selfBuffTurns);
            }
            magicSkillNames.push(`${s.name}→${comboName(combo)}`);
            consumeStacksForCombo(elementState);
          } else {
            cooldowns[s.id] = s.trigger.kind === "every_n_turns" ? s.trigger.n : 0;
          }
        } else if (s.effect.kind === "bonus_attacks") {
          bonusAttacks += s.effect.count;
          if (s.effect.guaranteedCrit) bonusAttacksWithCrit += s.effect.count;
        } else if (s.effect.kind === "apply_dot") {
          pendingBossDotStacks += s.effect.stackCount;
          if (s.effect.stunTurns) stunOnFire = Math.max(stunOnFire, s.effect.stunTurns);
          if (s.effect.lingerPerTurn && s.effect.lingerTurns) {
            dotLingerTurnsLeft = Math.max(dotLingerTurnsLeft, s.effect.lingerTurns);
            dotLingerPerTurn = Math.max(dotLingerPerTurn, s.effect.lingerPerTurn);
          }
          if (s.effect.ampBoostPct && s.effect.ampBoostTurns) {
            dotAmpBoostTurnsLeft = Math.max(dotAmpBoostTurnsLeft, s.effect.ampBoostTurns);
            dotAmpBoostPct = Math.max(dotAmpBoostPct, s.effect.ampBoostPct);
          }
        } else if (s.effect.kind === "dot_burst") {
          burstIntMultThisTurn = Math.max(burstIntMultThisTurn, s.effect.intMultPerStack);
        } else if (s.effect.kind === "self_heal") {
          triggeredSelfHealPct = Math.max(triggeredSelfHealPct, s.effect.pct);
        } else if (s.effect.kind === "shield_absorb") {
          // 얼음 방패 — INT × intMult 만큼 쉴드 획득. 재시전 시 덮어씀(스택 X).
          const newShield = Math.max(1, Math.floor(stats.int * s.effect.intMult));
          playerShield = newShield;
          turnEvents.push(`🛡 쉴드 ${newShield}`);
        } else if (s.effect.kind === "enemy_debuff") {
          if (s.effect.stat === "atk") {
            triggeredBossAtkDebuffPct = Math.max(triggeredBossAtkDebuffPct, s.effect.pct ?? 0);
            triggeredBossAtkDebuffTurns = Math.max(triggeredBossAtkDebuffTurns, s.effect.turns);
          } else if (s.effect.stat === "def") {
            triggeredBossDefDebuffPct = Math.max(triggeredBossDefDebuffPct, s.effect.pct ?? 0);
            triggeredBossDefDebuffTurns = Math.max(triggeredBossDefDebuffTurns, s.effect.turns);
          }
        } else if (s.effect.kind === "enemy_hp_pct_damage") {
          // 보스 컨텍스트 — bossOnly 통과
          let d = Math.floor(bHp * s.effect.pct);
          if (s.effect.cap) d = Math.min(d, s.effect.cap);
          triggeredHpPctDmg += d;
        } else if (s.effect.kind === "shield_strike") {
          const baseHit = Math.floor(playerEffDef * s.effect.defMult);
          const c = rollNonPhysicalCrit(passive, extraCritChance);
          shieldStrikeDmg += Math.floor(baseHit * c.mult);
          shieldStrikeName = s.name;
        } else if (s.effect.kind === "self_atk_buff") {
          if (s.effect.selfHpCostPct) {
            pHp = Math.max(1, pHp - stats.maxHp * s.effect.selfHpCostPct);
          }
          selfAtkBuffPct = s.effect.atkPct;
          selfAtkBuffTurnsLeft = s.effect.turns;
        } else if (s.effect.kind === "taunt") {
          triggeredTauntExtra += s.effect.extraEnemyAttacks;
        } else if (s.effect.kind === "reflect_boost") {
          reflectBoostPct = Math.max(reflectBoostPct, s.effect.pct);
          reflectBoostTurnsLeft = Math.max(reflectBoostTurnsLeft, s.effect.turns);
        }
      }
    }
    if (shieldFireSelfHpCostSum > 0) {
      pHp = Math.max(1, pHp - stats.maxHp * shieldFireSelfHpCostSum);
    }
    if (triggeredSelfHealPct > 0) {
      const heal = Math.floor(stats.maxHp * triggeredSelfHealPct);
      pHp = Math.min(stats.maxHp, pHp + heal);
      turnEvents.push(`✨ 자가회복 ${heal}`);
    }
    if (triggeredBossAtkDebuffTurns > 0) {
      bossAtkDebuffPct = Math.max(bossAtkDebuffPct, triggeredBossAtkDebuffPct);
      bossAtkDebuffTurns = Math.max(bossAtkDebuffTurns, triggeredBossAtkDebuffTurns);
    }
    if (triggeredBossDefDebuffTurns > 0) {
      bossDefDebuffPct = Math.max(bossDefDebuffPct, triggeredBossDefDebuffPct);
      bossDefDebuffTurns = Math.max(bossDefDebuffTurns, triggeredBossDefDebuffTurns);
    }

    // Apply DOT damage to player at start of turn (after boss skill)
    if (dotTurnsLeft > 0) {
      const rawDot = Math.max(1, Math.floor(stats.maxHp * dotPctPerTurn));
      let dotDmg = rawDot;
      if (playerShield > 0 && dotDmg > 0) {
        const absorbed = Math.min(playerShield, dotDmg);
        playerShield -= absorbed;
        dotDmg -= absorbed;
        if (absorbed > 0) turnEvents.push(`🛡 −${absorbed}`);
      }
      pHp -= dotDmg;
      totalDmgTaken += dotDmg;
      turnEvents.push(`☠ 독 ${rawDot}`);
      if (pHp <= 0) {
        log.push({
          turn: totalTurns,
          text: turnEvents.join(" · "),
          playerHpAfter: 0,
          bossHpAfter: Math.max(0, Math.floor(bHp)),
          elements: [...elementState.stacks],
          elementLingerTurns: elementState.lingerTurnsLeft,
        });
        break;
      }
    }

    const enemyDodge = dodgeChance(boss.agi);
    const basicAttackSlots = Math.max(0, totalSlots - skillsToFire.length);
    const damageSkillCount = damageSkillHits.length;
    const normalAttacks =
      basicAttackSlots + damageSkillCount + Math.max(0, bonusAttacks - bonusAttacksWithCrit);
    const totalAttacks = normalAttacks + bonusAttacksWithCrit;
    let effectiveBossDef = Math.floor(
      boss.def * (1 + (bossDefBoostTurnsLeft > 0 ? bossDefBoostPct : 0)),
    );
    if (bossDefDebuffTurns > 0) {
      effectiveBossDef = Math.floor(effectiveBossDef * (1 - bossDefDebuffPct));
    }
    let playerHitDamage = 0;
    let magicBasicDealtThisTurn = 0;
    let firstAttackHandled = false;
    const charName = character.name?.trim() || "모험가";
    const enemyName = boss.name;
    const enemyParticle = subjectParticle(enemyName);
    // 헤더 카운트 = 사용된 슬롯 총합 + 보너스 공격 (버프 슬롯도 "공격" 한 번으로 카운트).
    // 실제 데미지 라인 수와 다를 수 있음 — 버프 라인이 별도로 뒤에 추가되어 합 = 헤더값.
    const headerCount = totalSlots + bonusAttacks;
    if (headerCount > 0) {
      turnEvents.push(`🎯 ${charName}의 ${headerCount}회 공격!`);
    }
    for (let i = 0; i < totalAttacks; i++) {
      if (Math.random() < enemyDodge) {
        dodgesByEnemy++;
        turnEvents.push(`🎯 ${enemyName}${enemyParticle} 피했다!`);
        continue;
      }
      const isFirstAttack = !firstAttackHandled;
      firstAttackHandled = true;
      const isCritBonus = i >= normalAttacks;
      let firstHitMultExtra = 1;
      if (isFirstAttack && pendingNextHitMult > 1) {
        firstHitMultExtra = pendingNextHitMult;
        pendingNextHitMult = 0;
      }
      const skillHit = i < damageSkillCount ? damageSkillHits[i] : null;
      const baseMult = skillHit ? skillHit.mult : 1;
      const composedMult = baseMult * firstHitMultExtra;
      const critOut = { crit: false };
      const useMagicBasic = magicBasicIntMult > 0 && !skillHit;
      const baseDmg = useMagicBasic
        ? computePlayerMagicBasicDamage(playerEffInt, magicBasicIntMult, boss.mdef, {
            damageAmpPct: turnDmgAmpPct,
            magicDmgAmpPct,
            defPiercePct: extraDefPiercePct,
          })
        : computePlayerDamage(
            stats.atk,
            effectiveBossDef,
            passive,
            {
              atkBoostPct: turnAtkBoostPct,
              damageAmpPct: turnDmgAmpPct,
              extraCritChance,
              multiplier: composedMult > 1 ? composedMult : undefined,
              defPiercePct: extraDefPiercePct + (skillHit ? skillHit.defPiercePct : 0),
              guaranteedCritMult:
                isFirstAttack && critMult ? critMult : isCritBonus ? 2 : undefined,
            },
            critOut,
          );
      // 광전사 — 자기 HP 소모량을 평타에 flat 합산 (방어 무시 보너스)
      const dmg = baseDmg + (skillHit?.flatBonus ?? 0);
      bHp -= dmg;
      totalDmgDealt += dmg;
      if (useMagicBasic) magicBasicDealtThisTurn += dmg;
      else playerHitDamage += dmg;
      const critPrefix = critOut.crit ? "치명타! " : "";
      if (useMagicBasic) {
        turnEvents.push(`🔮 마력구체! ${dmg}의 피해를 입혔다!`);
      } else if (skillHit) {
        turnEvents.push(`⚡ 스킬 발동! ${skillHit.name}! ${critPrefix}${dmg}의 피해를 입혔다!`);
      } else {
        turnEvents.push(`⚔ ${critPrefix}${dmg}의 피해를 입혔다!`);
      }
      if (dmg > maxSingleHit) maxSingleHit = dmg;
      if (!skillHit && dotOnHitStacks > 0) pendingBossDotStacks += dotOnHitStacks;
      if (bHp <= 0) break;
      if (executeEveryHits > 0 && ++executeHitCount >= executeEveryHits) {
        executeHitCount = 0;
        const exDmg = Math.max(1, Math.floor(boss.hp * executeMaxHpPct * 0.5));
        bHp -= exDmg;
        totalDmgDealt += exDmg;
        playerHitDamage += exDmg;
        turnEvents.push(`💀 사형 ${exDmg}`);
        if (bHp <= 0) break;
      }
      if (followUpStrikePct > 0) {
        const fu = Math.max(1, Math.floor(dmg * followUpStrikePct));
        bHp -= fu;
        totalDmgDealt += fu;
        playerHitDamage += fu;
        if (bHp <= 0) break;
        if (executeEveryHits > 0 && ++executeHitCount >= executeEveryHits) {
          executeHitCount = 0;
          const exDmg = Math.max(1, Math.floor(boss.hp * executeMaxHpPct * 0.5));
          bHp -= exDmg;
          totalDmgDealt += exDmg;
          playerHitDamage += exDmg;
          turnEvents.push(`💀 사형 ${exDmg}`);
          if (bHp <= 0) break;
        }
      }
    }
    // 방패 강타 (shield_strike)
    if (shieldStrikeDmg > 0 && bHp > 0) {
      const skName = shieldStrikeName ?? "방패 강타";
      if (Math.random() < enemyDodge) {
        turnEvents.push(`⚡ 스킬 발동! ${skName}! ${enemyName}${enemyParticle} 피했다!`);
      } else {
        const finalDmg = Math.max(1, shieldStrikeDmg - effectiveBossDef);
        bHp -= finalDmg;
        totalDmgDealt += finalDmg;
        playerHitDamage += finalDmg;
        if (finalDmg > maxSingleHit) maxSingleHit = finalDmg;
        turnEvents.push(`⚡ 스킬 발동! ${skName}! ${finalDmg}의 피해를 입혔다!`);
      }
    }
    // 사형 선고 (HP %)
    if (triggeredHpPctDmg > 0 && bHp > 0) {
      bHp -= triggeredHpPctDmg;
      totalDmgDealt += triggeredHpPctDmg;
      turnEvents.push(`💀 처형 ${triggeredHpPctDmg}`);
    }
    // 갈증 (lifesteal physical)
    if (playerHitDamage > 0 && lifestealPhysicalPct > 0) {
      const heal = Math.floor(playerHitDamage * lifestealPhysicalPct);
      if (heal > 0) {
        pHp = Math.min(stats.maxHp, pHp + heal);
        turnEvents.push(`🩸 흡혈 ${heal}`);
      }
    }
    // 가시 오라 (thorn_aura) — DEF 기반 매 턴 데미지
    if (thornAuraDefMult > 0 && bHp > 0) {
      const thornDmg = Math.max(1, Math.floor(playerEffDef * thornAuraDefMult));
      bHp -= thornDmg;
      totalDmgDealt += thornDmg;
      turnEvents.push(`🌵 가시 ${thornDmg}`);
    }

    let magicDealt = 0;
    if (fireballDmg > 0 && bHp > 0) {
      const magicLabel = magicSkillNames.length > 0 ? magicSkillNames.join(", ") : "마법";
      if (Math.random() < enemyDodge) {
        dodgesByEnemy++;
        turnEvents.push(`⚡ 스킬 발동! ${magicLabel}! ${enemyName}${enemyParticle} 피했다!`);
      } else {
        magicDealt = Math.floor(fireballDmg * (1 + turnDmgAmpPct) * (1 + magicDmgAmpPct));
        bHp -= magicDealt;
        totalDmgDealt += magicDealt;
        if (magicDealt > maxSingleHit) maxSingleHit = magicDealt;
        turnEvents.push(`⚡ 스킬 발동! ${magicLabel}! ${magicDealt}의 피해를 입혔다!`);
      }
    }
    // 비-데미지 스킬 발동 로그 — 공격(물리/마법) 라인 뒤에 출력해 가독성 ↑
    if (pendingBuffLogs.length > 0) {
      for (const ev of pendingBuffLogs) turnEvents.push(ev);
    }
    // 마력 환류 — 스킬 마법 + 마력구체 기본 공격 합산
    {
      const totalMagicForLifesteal = magicDealt + magicBasicDealtThisTurn;
      if (totalMagicForLifesteal > 0 && lifestealMagicPct > 0) {
        const heal = Math.floor(totalMagicForLifesteal * lifestealMagicPct);
        if (heal > 0) {
          pHp = Math.min(stats.maxHp, pHp + heal);
          turnEvents.push(`💗 흡수 ${heal}`);
        }
      }
    }
    // 받는 DOT 데미지 증가 (독액 살포 발동 후 N턴) — 발동 턴 제외, 턴 시작 시 스냅샷
    const ampBoostActiveThisTurn = dotAmpBoostTurnsLeft > 0;
    // Lingering DOT — 죽음의 안개 발동 후 N턴 동안 매 턴 추가 스택
    if (dotLingerTurnsLeft > 0) {
      pendingBossDotStacks += dotLingerPerTurn;
      dotLingerTurnsLeft--;
    }
    // 보스 DOT 적용 (스택 누적, 캡까지)
    if (pendingBossDotStacks > 0) {
      bossDotStacks = Math.min(dotStackCap, bossDotStacks + pendingBossDotStacks);
    }
    const effectiveDotAmpPct = dotAmpPct + (ampBoostActiveThisTurn ? dotAmpBoostPct : 0);
    // 맹독 폭발 — 액티브 발동 시 보스의 모든 독 스택 폭발 (tick 대체)
    if (burstIntMultThisTurn > 0 && bossDotStacks > 0 && bHp > 0) {
      const burstDmg = Math.max(
        1,
        Math.floor(playerEffInt * burstIntMultThisTurn * bossDotStacks * (1 + effectiveDotAmpPct)),
      );
      bHp -= burstDmg;
      totalDmgDealt += burstDmg;
      bossDotStacks = 0;
      turnEvents.push(`💥 맹독 폭발 ${burstDmg}`);
    } else if (bossDotStacks > 0 && bHp > 0) {
      // DOT tick — stacks 만큼 데미지, 매 턴 자연 감소 1
      const dotDmg = Math.max(
        1,
        Math.floor(playerEffInt * DOT_BASE_INT_MULT * bossDotStacks * (1 + effectiveDotAmpPct)),
      );
      bHp -= dotDmg;
      totalDmgDealt += dotDmg;
      bossDotStacks = Math.max(0, bossDotStacks - 1);
      turnEvents.push(`☠ 독 ${dotDmg}`);
    }
    if (dotAmpBoostTurnsLeft > 0) dotAmpBoostTurnsLeft--;
    if (frostStun > 0 && bHp > 0) {
      stunOnFire = Math.max(stunOnFire, frostStun);
    }

    if (bHp <= 0) {
      log.push({
        turn: totalTurns,
        text: turnEvents.join(" · "),
        playerHpAfter: Math.max(0, Math.floor(pHp)),
        bossHpAfter: 0,
        elements: [...elementState.stacks],
        elementLingerTurns: elementState.lingerTurnsLeft,
      });
      break;
    }

    if (stunOnFire > 0) {
      stunnedTurns = stunOnFire;
      turnEvents.push(`✋ 적 ${stunOnFire}턴 스턴`);
    }

    if (!bossHandled) {
      runBossPhase();
    }

    // Decrement boss buff/debuff timers at end of turn
    if (bossAtkBoostTurnsLeft > 0) bossAtkBoostTurnsLeft--;
    if (bossDefBoostTurnsLeft > 0) bossDefBoostTurnsLeft--;
    if (dotTurnsLeft > 0) dotTurnsLeft--;
    if (spdDebuffTurnsLeft > 0) spdDebuffTurnsLeft--;
    if (bossSpdDebuffTurns > 0) bossSpdDebuffTurns--;
    if (bossAtkDebuffTurns > 0) bossAtkDebuffTurns--;
    if (bossDefDebuffTurns > 0) bossDefDebuffTurns--;
    if (selfAtkBuffTurnsLeft > 0) selfAtkBuffTurnsLeft--;
    if (reflectBoostTurnsLeft > 0) reflectBoostTurnsLeft--;

    if (pHp <= 0) {
      log.push({
        turn: totalTurns,
        text: turnEvents.join(" · "),
        playerHpAfter: 0,
        bossHpAfter: Math.max(0, Math.floor(bHp)),
        elements: [...elementState.stacks],
        elementLingerTurns: elementState.lingerTurnsLeft,
      });
      break;
    }

    if (healPerTurnPct > 0) {
      const heal = stats.maxHp * healPerTurnPct;
      pHp = Math.min(stats.maxHp, pHp + heal);
      if (heal >= 1) turnEvents.push(`✨ 회복 ${Math.floor(heal)}`);
    }
    timeLeft--;

    log.push({
      turn: totalTurns,
      text: turnEvents.length > 0 ? turnEvents.join(" · ") : "—",
      playerHpAfter: Math.floor(pHp),
      bossHpAfter: Math.max(0, Math.floor(bHp)),
      elements: [...elementState.stacks],
      elementLingerTurns: elementState.lingerTurnsLeft,
    });
  }

  const defeated = bHp <= 0;
  const diedEarly = pHp <= 0 && !defeated;

  const gained: Partial<Resources> = {};
  const droppedMaterials: Materials = {};
  let exp = 0;
  let droppedUniqueEquipment: EquipmentId | undefined;

  if (defeated) {
    const guildMult = Math.min(1.5, 1 + guild.reputation * 0.0005);
    const finalMult = guildMult * BOSS_REWARD_MULT * TEST_REWARD_MULT;
    const goldRange = region.drops.gold;
    const ironRange = region.drops.iron;
    if (goldRange) {
      gained.gold = Math.floor(
        Math.floor(goldRange[0] + Math.random() * (goldRange[1] - goldRange[0] + 1)) * finalMult,
      );
    }
    if (ironRange) {
      gained.iron = Math.floor(
        Math.floor(ironRange[0] + Math.random() * (ironRange[1] - ironRange[0] + 1)) * finalMult,
      );
    }
    exp = Math.floor(region.expReward * BOSS_REWARD_MULT * TEST_REWARD_MULT);
    droppedMaterials[boss.drop] = 1;
    let scrollCount = boss.scrollDrop.guaranteedCount ?? 0;
    if (Math.random() < boss.scrollDrop.chance) scrollCount++;
    if (scrollCount > 0) {
      droppedMaterials[boss.scrollDrop.id] =
        (droppedMaterials[boss.scrollDrop.id] ?? 0) + scrollCount;
    }
    if (boss.uniqueDrop && Math.random() < boss.uniqueDrop.chance) {
      droppedUniqueEquipment = boss.uniqueDrop.id;
    }
  }

  return {
    className,
    bossName: boss.name,
    defeated,
    diedEarly,
    totalTurns,
    damageDealt: totalDmgDealt,
    damageTaken: totalDmgTaken,
    dodgesByPlayer,
    dodgesByEnemy,
    skillActivations,
    finalHp: Math.max(0, pHp),
    gained,
    exp,
    droppedMaterials,
    droppedUniqueEquipment,
    log,
    maxSingleHit,
  };
};
