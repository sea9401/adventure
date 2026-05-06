import {
  AGI_DODGE_CAP,
  CLASSES,
  DISPATCH_REWARD_MULT,
  DOT_BASE_INT_MULT,
  DOT_STACK_CAP,
  HP_REGEN_PER_SEC,
  TEST_REWARD_MULT,
  TREASURE_ROLL_PERIOD_SEC,
} from "../data";
import type { DispatchDuration } from "../data";
import type {
  Character,
  DispatchLogEntry,
  DispatchResult,
  Guild,
  Materials,
  Region,
  Resources,
  SkillId,
  Treasure,
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
  pickEnemy,
  playerAgiCritChance,
  playerDodgeChance,
  randInt,
  rollNonPhysicalCrit,
} from "./damage";
import type { MonumentExtra } from "../monument";

export const resolveDispatch = (
  character: Character,
  region: Region,
  guild: Guild,
  durationSec: DispatchDuration,
  monumentBonus?: MonumentExtra,
  innLv: number = 0,
): DispatchResult => {
  const baseStats = computeStats(character, monumentBonus);
  const stats = { ...baseStats };
  const passive = getActivePassive(character);
  const className = getActiveClassName(character);
  const cls = CLASSES[character.currentClass];
  // 숙소 회복 — 탐험 중에도 매 턴 적용 (방치형 장시간 탐험 생존성 확보)
  const innRegenPerTurn = innLv > 0 ? HP_REGEN_PER_SEC(innLv) : 0;
  let pHp = character.currentHp;
  let playerShield = 0; // 얼음 방패 등 — 받는 데미지 우선 흡수, 소진 시까지 지속
  let timeLeft = durationSec;

  let enemy = pickEnemy(region);
  let enemyHp = enemy.hp;

  const killCounts: Record<string, number> = {};
  let totalKills = 0;
  let totalDmgDealt = 0;
  let maxSingleHit = 0;
  let totalDmgTaken = 0;
  let totalTurns = 0;
  let dodgesByPlayer = 0;
  let dodgesByEnemy = 0;
  let diedEarly = false;
  let executeHitCount = 0;

  // Skills setup
  const equippedSkills = getEquippedSkills(character);
  const skillActivations: Partial<Record<SkillId, number>> = {};
  const cooldowns: Partial<Record<SkillId, number>> = {};
  for (const s of equippedSkills) {
    if (s.trigger.kind === "every_n_turns") cooldowns[s.id] = s.trigger.n;
  }
  // Resolve passive bonuses upfront
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
  let onKillExtraAttacks = 0;
  let counterAttacksPerDodge = 0;
  let dodgeNextHitMult = 0;
  let reviveTriggerHpPct = 0;
  let reviveRestoreHpPct = 0;
  let extraDefPiercePct = 0;
  let skillTurnStartIntMult = 0;
  let dotAmpPct = 0;
  let dotStackCap = DOT_STACK_CAP;
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
    if (s.effect.kind === "damage_amplify") damageAmpPct += s.effect.pct;
    if (s.effect.kind === "dot_amp") dotAmpPct += s.effect.pct;
    if (s.effect.kind === "damage_reduction") dmgReductionPct += s.effect.pct;
    if (s.effect.kind === "reflect_on_hit") shieldReflectPct += s.effect.defMult;
    if (s.effect.kind === "crit_chance_boost") extraCritChance += s.effect.chance;
    if (s.effect.kind === "magic_damage_amp") magicDmgAmpPct += s.effect.pct;
    if (s.effect.kind === "heal_per_turn") healPerTurnPct += s.effect.pct;
    if (s.effect.kind === "lifesteal") {
      if (s.effect.source === "magic") lifestealMagicPct += s.effect.pct;
      else lifestealPhysicalPct += s.effect.pct;
    }
    if (s.effect.kind === "conditional_modifier" && s.effect.trigger === "hp_below_pct") {
      condHpBelowThreshold = Math.max(condHpBelowThreshold, s.effect.threshold ?? 0.5);
      condHpBelowAtkPct += s.effect.atkPct ?? 0;
      condHpBelowDmgAmpPct += s.effect.dmgAmpPct ?? 0;
      condHpBelowSpdFlat += s.effect.spdFlat ?? 0;
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
    if (s.effect.kind === "on_kill_extra_attack") onKillExtraAttacks += s.effect.count;
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
  // class passive 적용 (advancedClass 우선 — getActivePassive에서 이미 결정)
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
  // flat_stat → stats 반영
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
  const totalTurnStartIntMult = skillTurnStartIntMult + auraTurnStartIntMult;
  const playerDodge = Math.min(
    AGI_DODGE_CAP,
    playerDodgeChance(cls, stats.agi) + dodgeBoostFlat + flatDodgePct,
  );
  let stunnedTurns = 0;
  let enemySpdDebuffTurns = 0;
  let enemySpdDebuffAmount = 0;
  let enemyDotStacks = 0;
  let dotLingerTurnsLeft = 0;
  let dotLingerPerTurn = 0;
  let dotAmpBoostTurnsLeft = 0;
  let dotAmpBoostPct = 0;
  // B2 state
  let pendingNextHitMult = 0;
  let reviveAvailable = reviveRestoreHpPct > 0;
  let selfAtkBuffPct = 0;
  let selfAtkBuffTurnsLeft = 0;
  let reflectBoostPct = 0;
  let reflectBoostTurnsLeft = 0;
  let enemyAtkDebuffPct = 0;
  let enemyAtkDebuffTurns = 0;
  let enemyDefDebuffPct = 0;
  let enemyDefDebuffTurns = 0;
  // 원소술사 — 전투 한정 스택/잔존 (24 plan)
  const elementState = initElementState();
  let comboSelfSpdFlat = 0;
  let comboSelfMdefPctBuff = 0;
  let comboSelfBuffTurnsLeft = 0;

  const droppedMaterials: Materials = {};
  const gained: Partial<Resources> = { gold: 0, iron: 0 };
  let totalExp = 0;
  const log: DispatchLogEntry[] = [];
  // 마력 환류 — 전투 한정 카운터 (턴 사이 보존)
  let magicCastCounter = 0;
  let condensationActive = false;

  while (timeLeft > 0 && pHp > 0) {
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
    const effInt = Math.floor(stats.int * elemIntMult);
    const effDef = Math.floor(stats.def * elemDefMult);
    void comboSelfMdefPctBuff; // resolveDispatch는 enemy 마법 공격 없음 (MDEF 미사용)

    // 조건부 buff (HP 임계 — 매 턴 재평가) + 광전사 missing_hp_atk
    const hpRatio = stats.maxHp > 0 ? pHp / stats.maxHp : 1;
    const isLowHp = hpRatio <= condHpBelowThreshold;
    let turnAtkBoostPct = atkBoostPct + (isLowHp ? condHpBelowAtkPct : 0);
    const turnDmgAmpPct = damageAmpPct + (isLowHp ? condHpBelowDmgAmpPct : 0);
    if (berserkerAtkPct > 0) {
      turnAtkBoostPct += berserkerAtkPct;
    }
    if (selfAtkBuffTurnsLeft > 0) {
      turnAtkBoostPct += selfAtkBuffPct;
    }
    if (berserkerHpDrainPct > 0 && pHp > 0) {
      pHp = Math.max(1, pHp - stats.maxHp * berserkerHpDrainPct);
    }

    // 원소술사 패시브 (마력 분출) + turn_start_magic 스킬: 턴 시작 시 자동 마법 공격
    if (totalTurnStartIntMult > 0 && enemyHp > 0) {
      const dmg = Math.max(
        1,
        Math.floor(effInt * totalTurnStartIntMult * elemTurnStartMult) - enemy.mdef,
      );
      const finalDmg = Math.floor(dmg * (1 + turnDmgAmpPct) * (1 + magicDmgAmpPct));
      enemyHp -= finalDmg;
      totalDmgDealt += finalDmg;
    }

    // 행동 슬롯 계산 (SPD 기반). 액티브 스킬 발동은 슬롯을 소모.
    const effectivePlayerSpd = stats.spd + (isLowHp ? condHpBelowSpdFlat : 0) + elemSpdFlat;
    const totalSlots = computeAttackCount(effectivePlayerSpd);

    // 선공 결정: SPD 비교 (동률은 플레이어 우선)
    const enemyEffectiveSpdForOrder = Math.max(
      0,
      enemy.spd - (enemySpdDebuffTurns > 0 ? enemySpdDebuffAmount : 0) - speedAuraEnemy,
    );
    const playerFirst = effectivePlayerSpd >= enemyEffectiveSpdForOrder;
    let enemyHandled = false;

    // 적 행동 페이즈 (선공 여부에 따라 호출 시점 달라짐)
    const runEnemyPhase = () => {
      let pendingCounters = 0;
      let enemyHitTotal = 0;
      let enemyDodgeCount = 0;
      if (stunnedTurns > 0) {
        stunnedTurns--;
        turnEvents.push(`✋ 스턴`);
      } else {
        const enemyEffectiveSpd = Math.max(
          0,
          enemy.spd - (enemySpdDebuffTurns > 0 ? enemySpdDebuffAmount : 0) - speedAuraEnemy,
        );
        const eAttacks = computeAttackCount(enemyEffectiveSpd) + triggeredTauntExtra;
        const debuffedAtk =
          enemyAtkDebuffTurns > 0 ? Math.floor(enemy.atk * (1 - enemyAtkDebuffPct)) : enemy.atk;
        let reflectHits = 0;
        for (let i = 0; i < eAttacks; i++) {
          if (Math.random() < playerDodge) {
            dodgesByPlayer++;
            enemyDodgeCount++;
            if (counterAttacksPerDodge > 0) pendingCounters += counterAttacksPerDodge;
            if (dodgeNextHitMult > 1) pendingNextHitMult = dodgeNextHitMult;
            continue;
          }
          const rawDmg = computeEnemyDamage(
            debuffedAtk,
            effDef,
            passive,
            dmgReductionPct + elemDmgReduction,
          );
          let dmg = rawDmg;
          if (playerShield > 0 && dmg > 0) {
            const absorbed = Math.min(playerShield, dmg);
            playerShield -= absorbed;
            dmg -= absorbed;
            if (absorbed > 0) turnEvents.push(`🛡 −${absorbed}`);
          }
          pHp -= dmg;
          totalDmgTaken += dmg;
          enemyHitTotal += dmg;
          reflectHits++;
          if (pHp <= 0) break;
        }
        if (shieldReflectPct > 0 && reflectHits > 0 && enemyHp > 0) {
          const effectiveReflectPct =
            shieldReflectPct + (reflectBoostTurnsLeft > 0 ? reflectBoostPct : 0);
          const reflectPerHit = Math.max(1, Math.floor(effDef * effectiveReflectPct));
          const totalReflect = reflectPerHit * reflectHits;
          enemyHp -= totalReflect;
          totalDmgDealt += totalReflect;
          turnEvents.push(`⚡ 반사 ${totalReflect}`);
        }
      }
      if (enemyHitTotal > 0) turnEvents.push(`🛡 ${enemyHitTotal}`);
      if (enemyDodgeCount > 0) turnEvents.push(`✨ ${enemyDodgeCount}회피`);

      // 무영각 카운터 발동 (적 턴 종료 직후)
      if (pendingCounters > 0 && enemyHp > 0) {
        const enemyDodge2 = dodgeChance(enemy.agi);
        let counterDmg = 0;
        for (let c = 0; c < pendingCounters; c++) {
          if (Math.random() < enemyDodge2) {
            dodgesByEnemy++;
            continue;
          }
          const dmg =
            magicBasicIntMult > 0
              ? computePlayerMagicBasicDamage(effInt, magicBasicIntMult, enemy.mdef, {
                  damageAmpPct: turnDmgAmpPct,
                  magicDmgAmpPct,
                  defPiercePct: extraDefPiercePct,
                })
              : computePlayerDamage(stats.atk, enemy.def, passive, {
                  atkBoostPct: turnAtkBoostPct,
                  damageAmpPct: turnDmgAmpPct,
                  extraCritChance,
                  defPiercePct: extraDefPiercePct,
                });
          enemyHp -= dmg;
          totalDmgDealt += dmg;
          counterDmg += dmg;
          if (enemyHp <= 0) break;
        }
        if (counterDmg > 0) turnEvents.push(`🔁 ${counterDmg}`);
      }

      // 순교 — HP 임계 이하로 떨어졌는지 확인
      if (reviveAvailable && stats.maxHp > 0 && pHp / stats.maxHp <= reviveTriggerHpPct) {
        pHp = Math.max(pHp, Math.floor(stats.maxHp * reviveRestoreHpPct));
        reviveAvailable = false;
        turnEvents.push(`✨ 순교`);
      }
    };

    // 적이 더 빠르면 먼저 행동
    if (!playerFirst) {
      runEnemyPhase();
      enemyHandled = true;
      if (pHp <= 0) {
        diedEarly = true;
        turnEvents.push(`💀 사망`);
        log.push({
          turn: totalTurns,
          text: turnEvents.join(" · ") || "—",
          playerHpAfter: 0,
          elements: [...elementState.stacks],
          elementLingerTurns: elementState.lingerTurnsLeft,
        });
        break;
      }
    }

    // Tick cooldowns and check active skill triggers
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
    let bonusAttacks = 0;
    let bonusAttacksWithCrit = 0;
    let pendingEnemySpdDebuffAmount = 0;
    let pendingEnemySpdDebuffTurns = 0;
    let pendingDotStacks = 0;
    let burstIntMultThisTurn = 0;
    let triggeredSelfHealPct = 0;
    let triggeredEnemyAtkDebuffPct = 0;
    let triggeredEnemyAtkDebuffTurns = 0;
    let triggeredEnemyDefDebuffPct = 0;
    let triggeredEnemyDefDebuffTurns = 0;
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
    // 발동 못한 스킬은 쿨 유지 → 다음 턴 우선 발동
    // 비-데미지 스킬(버프/디버프/회복 등) 발동 로그는 공격 데미지 라인 뒤로 미룸.
    const pendingBuffLogs: string[] = [];
    const damageKinds = [
      "extra_damage_with_stun",
      "magic_damage",
      "magic_damage_with_spd_debuff",
      "shield_strike",
    ];

    for (const s of skillsToFire) {
      cooldowns[s.id] = 0;
      skillActivations[s.id] = (skillActivations[s.id] ?? 0) + 1;
      if (damageKinds.includes(s.effect.kind)) {
        // 데미지 스킬은 발동 표기 즉시 푸시 (해당 데미지 라인 직전에 표시)
        turnEvents.push(`⚡ ${s.name}`);
      } else {
        // 비-데미지 스킬은 후처리 — pendingBuffLogs에 보관
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
          const eDef = s.effect.ignoreMdef ? 0 : enemy.mdef;
          const baseHit = Math.max(1, Math.floor(effInt * s.effect.intMult) - eDef);
          for (let i = 0; i < hits; i++) {
            const c = rollNonPhysicalCrit(passive, extraCritChance + elemMagicCrit);
            fireballDmg += Math.floor(baseHit * c.mult);
          }
          // 화염구 등 — 즉발 데미지 + 화상 DOT 스택 부여
          if (s.effect.dotStacks) pendingDotStacks += s.effect.dotStacks;
        } else if (s.effect.kind === "magic_damage_with_spd_debuff") {
          const baseHit = Math.max(1, Math.floor(effInt * s.effect.intMult) - enemy.mdef);
          const c = rollNonPhysicalCrit(passive, extraCritChance + elemMagicCrit);
          fireballDmg += Math.floor(baseHit * c.mult);
          pendingEnemySpdDebuffAmount = Math.max(pendingEnemySpdDebuffAmount, s.effect.spdAmount);
          pendingEnemySpdDebuffTurns = Math.max(pendingEnemySpdDebuffTurns, s.effect.spdTurns);
        } else if (s.effect.kind === "apply_element") {
          // 즉발 데미지 0, 자기 스택 +1 (FIFO push out at cap)
          pushElementStack(elementState, s.effect.element);
          if (s.effect.enemyDebuff?.stat === "spd") {
            pendingEnemySpdDebuffAmount = Math.max(
              pendingEnemySpdDebuffAmount,
              -s.effect.enemyDebuff.flat,
            );
            pendingEnemySpdDebuffTurns = Math.max(
              pendingEnemySpdDebuffTurns,
              s.effect.enemyDebuff.turns,
            );
          }
        } else if (s.effect.kind === "elemental_combo") {
          const combo = pickCombo(elementState.stacks);
          if (combo) {
            const ce = lookupComboEffect(combo, [...elementState.stacks]);
            const eDef = ce.ignoreMdef ? 0 : enemy.mdef;
            const baseHit = Math.max(1, Math.floor(effInt * ce.intMult) - eDef);
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
            if (ce.dotStacks) pendingDotStacks += ce.dotStacks;
            if (ce.enemySpdZeroTurns) {
              pendingEnemySpdDebuffAmount = Math.max(pendingEnemySpdDebuffAmount, enemy.spd);
              pendingEnemySpdDebuffTurns = Math.max(
                pendingEnemySpdDebuffTurns,
                ce.enemySpdZeroTurns,
              );
            }
            if (ce.enemySpdDebuff && ce.enemyDebuffTurns) {
              pendingEnemySpdDebuffAmount = Math.max(
                pendingEnemySpdDebuffAmount,
                ce.enemySpdDebuff,
              );
              pendingEnemySpdDebuffTurns = Math.max(
                pendingEnemySpdDebuffTurns,
                ce.enemyDebuffTurns,
              );
            }
            if (ce.enemyDefMdefDebuffPct && ce.enemyDebuffTurns) {
              triggeredEnemyDefDebuffPct = Math.max(
                triggeredEnemyDefDebuffPct,
                ce.enemyDefMdefDebuffPct,
              );
              triggeredEnemyDefDebuffTurns = Math.max(
                triggeredEnemyDefDebuffTurns,
                ce.enemyDebuffTurns,
              );
            }
            if (ce.selfBuffTurns) {
              comboSelfSpdFlat = Math.max(comboSelfSpdFlat, ce.selfSpdBuff ?? 0);
              comboSelfMdefPctBuff = Math.max(comboSelfMdefPctBuff, ce.selfMdefBuffPct ?? 0);
              comboSelfBuffTurnsLeft = Math.max(comboSelfBuffTurnsLeft, ce.selfBuffTurns);
            }
            turnEvents.push(`✨ ${comboName(combo)}`);
            consumeStacksForCombo(elementState);
          } else {
            // 스택 없음 — cd 그대로 (다음 턴 재시도)
            cooldowns[s.id] = s.trigger.kind === "every_n_turns" ? s.trigger.n : 0;
          }
        } else if (s.effect.kind === "bonus_attacks") {
          bonusAttacks += s.effect.count;
          if (s.effect.guaranteedCrit) bonusAttacksWithCrit += s.effect.count;
        } else if (s.effect.kind === "apply_dot") {
          pendingDotStacks += s.effect.stackCount;
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
            triggeredEnemyAtkDebuffPct = Math.max(triggeredEnemyAtkDebuffPct, s.effect.pct ?? 0);
            triggeredEnemyAtkDebuffTurns = Math.max(triggeredEnemyAtkDebuffTurns, s.effect.turns);
          } else if (s.effect.stat === "def") {
            triggeredEnemyDefDebuffPct = Math.max(triggeredEnemyDefDebuffPct, s.effect.pct ?? 0);
            triggeredEnemyDefDebuffTurns = Math.max(triggeredEnemyDefDebuffTurns, s.effect.turns);
          }
        } else if (s.effect.kind === "enemy_hp_pct_damage") {
          // resolveDispatch는 일반 적 — bossOnly 스킬은 발동 안 함
          if (!s.effect.bossOnly) {
            let d = Math.floor(enemyHp * s.effect.pct);
            if (s.effect.cap) d = Math.min(d, s.effect.cap);
            triggeredHpPctDmg += d;
          }
        } else if (s.effect.kind === "shield_strike") {
          const baseHit = Math.floor(effDef * s.effect.defMult);
          const c = rollNonPhysicalCrit(passive, extraCritChance);
          shieldStrikeDmg += Math.floor(baseHit * c.mult);
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
    // 폭렬권/파괴의 일격 등 자기 HP 소모
    if (shieldFireSelfHpCostSum > 0) {
      pHp = Math.max(1, pHp - stats.maxHp * shieldFireSelfHpCostSum);
    }
    // 신성한 빛 자가 회복
    if (triggeredSelfHealPct > 0) {
      pHp = Math.min(stats.maxHp, pHp + stats.maxHp * triggeredSelfHealPct);
    }
    // 적 ATK 디버프 적용
    if (triggeredEnemyAtkDebuffTurns > 0) {
      enemyAtkDebuffPct = Math.max(enemyAtkDebuffPct, triggeredEnemyAtkDebuffPct);
      enemyAtkDebuffTurns = Math.max(enemyAtkDebuffTurns, triggeredEnemyAtkDebuffTurns);
    }
    // 적 DEF 디버프 적용
    if (triggeredEnemyDefDebuffTurns > 0) {
      enemyDefDebuffPct = Math.max(enemyDefDebuffPct, triggeredEnemyDefDebuffPct);
      enemyDefDebuffTurns = Math.max(enemyDefDebuffTurns, triggeredEnemyDefDebuffTurns);
    }
    const effectiveEnemyDef =
      enemyDefDebuffTurns > 0 ? Math.floor(enemy.def * (1 - enemyDefDebuffPct)) : enemy.def;

    // Player attacks (slot-aware: 발동된 스킬은 슬롯 소모, 남은 슬롯 = 기본 공격)
    const enemyDodge = dodgeChance(enemy.agi);
    const basicAttackSlots = Math.max(0, totalSlots - skillsToFire.length);
    const damageSkillCount = damageSkillHits.length;
    const normalAttacks =
      basicAttackSlots + damageSkillCount + Math.max(0, bonusAttacks - bonusAttacksWithCrit);
    const totalAttacks = normalAttacks + bonusAttacksWithCrit;
    let physicalDealtThisTurn = 0;
    let magicBasicDealtThisTurn = 0;
    let firstAttackHandled = false;
    for (let i = 0; i < totalAttacks; i++) {
      if (Math.random() < enemyDodge) {
        dodgesByEnemy++;
        continue;
      }
      const isFirstAttack = !firstAttackHandled;
      firstAttackHandled = true;
      const isCritBonus = i >= normalAttacks;
      // 결의의 방패 다음 공격 ×N 일회성 mult
      let firstHitMultExtra = 1;
      if (isFirstAttack && pendingNextHitMult > 1) {
        firstHitMultExtra = pendingNextHitMult;
        pendingNextHitMult = 0;
      }
      const skillHit = i < damageSkillCount ? damageSkillHits[i] : null;
      const baseMult = skillHit ? skillHit.mult : 1;
      const composedMult = baseMult * firstHitMultExtra;
      // 마법사 마력구체 — skillHit 없는 기본 공격을 INT 마법으로 대체
      const useMagicBasic = magicBasicIntMult > 0 && !skillHit;
      const baseDmg = useMagicBasic
        ? computePlayerMagicBasicDamage(effInt, magicBasicIntMult, enemy.mdef, {
            damageAmpPct: turnDmgAmpPct,
            magicDmgAmpPct,
            defPiercePct: extraDefPiercePct,
          })
        : computePlayerDamage(stats.atk, effectiveEnemyDef, passive, {
            atkBoostPct: turnAtkBoostPct,
            damageAmpPct: turnDmgAmpPct,
            extraCritChance,
            multiplier: composedMult > 1 ? composedMult : undefined,
            defPiercePct: extraDefPiercePct + (skillHit ? skillHit.defPiercePct : 0),
            guaranteedCritMult: isFirstAttack && critMult ? critMult : isCritBonus ? 2 : undefined,
          });
      // 광전사 — 자기 HP 소모량을 평타에 flat 합산 (방어 무시 보너스)
      const dmg = baseDmg + (skillHit?.flatBonus ?? 0);
      enemyHp -= dmg;
      totalDmgDealt += dmg;
      if (useMagicBasic) magicBasicDealtThisTurn += dmg;
      else physicalDealtThisTurn += dmg;
      if (dmg > maxSingleHit) maxSingleHit = dmg;
      if (!skillHit && dotOnHitStacks > 0) pendingDotStacks += dotOnHitStacks;
      if (enemyHp <= 0) break;
      if (executeEveryHits > 0 && ++executeHitCount >= executeEveryHits) {
        executeHitCount = 0;
        const exDmg = Math.max(1, Math.floor(enemy.hp * executeMaxHpPct));
        enemyHp -= exDmg;
        totalDmgDealt += exDmg;
        physicalDealtThisTurn += exDmg;
        turnEvents.push(`💀 사형 ${exDmg}`);
        if (enemyHp <= 0) break;
      }
      if (followUpStrikePct > 0) {
        const fu = Math.max(1, Math.floor(dmg * followUpStrikePct));
        enemyHp -= fu;
        totalDmgDealt += fu;
        physicalDealtThisTurn += fu;
        if (enemyHp <= 0) break;
        if (executeEveryHits > 0 && ++executeHitCount >= executeEveryHits) {
          executeHitCount = 0;
          const exDmg = Math.max(1, Math.floor(enemy.hp * executeMaxHpPct));
          enemyHp -= exDmg;
          totalDmgDealt += exDmg;
          physicalDealtThisTurn += exDmg;
          turnEvents.push(`💀 사형 ${exDmg}`);
          if (enemyHp <= 0) break;
        }
      }
    }
    if (physicalDealtThisTurn > 0) turnEvents.push(`⚔ ${physicalDealtThisTurn}`);
    // 방패 강타 (shield_strike) — DEF 기반 데미지
    if (shieldStrikeDmg > 0 && enemyHp > 0) {
      if (Math.random() < enemyDodge) {
        dodgesByEnemy++;
      } else {
        const finalDmg = Math.max(1, shieldStrikeDmg - effectiveEnemyDef);
        enemyHp -= finalDmg;
        totalDmgDealt += finalDmg;
        physicalDealtThisTurn += finalDmg;
        if (finalDmg > maxSingleHit) maxSingleHit = finalDmg;
        turnEvents.push(`⚒ ${finalDmg}`);
      }
    }
    // 사형 선고 (HP %) — 일반 적엔 발동 안 함
    if (triggeredHpPctDmg > 0 && enemyHp > 0) {
      enemyHp -= triggeredHpPctDmg;
      totalDmgDealt += triggeredHpPctDmg;
    }
    // 갈증 (lifesteal physical)
    if (physicalDealtThisTurn > 0 && lifestealPhysicalPct > 0) {
      const heal = Math.floor(physicalDealtThisTurn * lifestealPhysicalPct);
      if (heal > 0) {
        pHp = Math.min(stats.maxHp, pHp + heal);
        turnEvents.push(`🩸 ${heal}`);
      }
    }
    // 가시 오라 (thorn_aura) — DEF 기반 매 턴 데미지
    if (thornAuraDefMult > 0 && enemyHp > 0) {
      const thornDmg = Math.max(1, Math.floor(effDef * thornAuraDefMult));
      enemyHp -= thornDmg;
      totalDmgDealt += thornDmg;
      turnEvents.push(`🌵 ${thornDmg}`);
    }

    // Magic damage (fireball/chain_lightning/meteor 등)
    let magicDealt = 0;
    if (fireballDmg > 0 && enemyHp > 0) {
      if (Math.random() < enemyDodge) {
        dodgesByEnemy++;
      } else {
        magicDealt = Math.floor(fireballDmg * (1 + turnDmgAmpPct) * (1 + magicDmgAmpPct));
        enemyHp -= magicDealt;
        totalDmgDealt += magicDealt;
        if (magicDealt > maxSingleHit) maxSingleHit = magicDealt;
        turnEvents.push(`🔥 ${magicDealt}`);
      }
    }
    // 비-데미지 스킬 발동 로그 — 공격(물리/마법) 라인 뒤에 출력해 가독성 ↑
    if (pendingBuffLogs.length > 0) {
      for (const ev of pendingBuffLogs) turnEvents.push(ev);
    }
    // 마력 환류: 마법 데미지의 X% HP 회복 (스킬 마법 + 마력구체 기본 공격 합산)
    {
      const totalMagicForLifesteal = magicDealt + magicBasicDealtThisTurn;
      if (totalMagicForLifesteal > 0 && lifestealMagicPct > 0) {
        const heal = Math.floor(totalMagicForLifesteal * lifestealMagicPct);
        if (heal > 0) {
          pHp = Math.min(stats.maxHp, pHp + heal);
          turnEvents.push(`💗 ${heal}`);
        }
      }
    }
    // Apply enemy SPD debuff from frost_bind (this turn or pending)
    if (pendingEnemySpdDebuffTurns > 0) {
      enemySpdDebuffTurns = Math.max(enemySpdDebuffTurns, pendingEnemySpdDebuffTurns);
      enemySpdDebuffAmount = Math.max(enemySpdDebuffAmount, pendingEnemySpdDebuffAmount);
    }
    // 받는 DOT 데미지 증가 (독액 살포 발동 후 N턴) — 발동 턴 제외, 턴 시작 시 스냅샷
    const ampBoostActiveThisTurn = dotAmpBoostTurnsLeft > 0;
    // Lingering DOT — 죽음의 안개 발동 후 N턴 동안 매 턴 추가 스택
    if (dotLingerTurnsLeft > 0) {
      pendingDotStacks += dotLingerPerTurn;
      dotLingerTurnsLeft--;
    }
    // Apply DOT (스택 누적, 캡까지)
    if (pendingDotStacks > 0) {
      enemyDotStacks = Math.min(dotStackCap, enemyDotStacks + pendingDotStacks);
    }
    const effectiveDotAmpPct = dotAmpPct + (ampBoostActiveThisTurn ? dotAmpBoostPct : 0);
    // 맹독 폭발 — 액티브 발동 시 적의 모든 독 스택 폭발 (tick 대체)
    if (burstIntMultThisTurn > 0 && enemyDotStacks > 0 && enemyHp > 0) {
      const burstDmg = Math.max(
        1,
        Math.floor(effInt * burstIntMultThisTurn * enemyDotStacks * (1 + effectiveDotAmpPct)),
      );
      enemyHp -= burstDmg;
      totalDmgDealt += burstDmg;
      enemyDotStacks = 0;
      turnEvents.push(`💥 맹독 폭발 ${burstDmg}`);
    } else if (enemyDotStacks > 0 && enemyHp > 0) {
      // DOT tick — stacks 만큼 데미지, 매 턴 자연 감소 1
      const dotDmg = Math.max(
        1,
        Math.floor(effInt * DOT_BASE_INT_MULT * enemyDotStacks * (1 + effectiveDotAmpPct)),
      );
      enemyHp -= dotDmg;
      totalDmgDealt += dotDmg;
      enemyDotStacks = Math.max(0, enemyDotStacks - 1);
      turnEvents.push(`☠ ${dotDmg}`);
    }
    if (dotAmpBoostTurnsLeft > 0) dotAmpBoostTurnsLeft--;

    if (enemyHp <= 0) {
      // Enemy killed
      turnEvents.push(`💀 ${enemy.name} 처치`);
      killCounts[enemy.name] = (killCounts[enemy.name] ?? 0) + 1;
      totalKills++;

      // Drops per kill
      gained.gold =
        (gained.gold ?? 0) + randInt(region.drops.gold?.[0] ?? 0, region.drops.gold?.[1] ?? 0);
      gained.iron =
        (gained.iron ?? 0) + randInt(region.drops.iron?.[0] ?? 0, region.drops.iron?.[1] ?? 0);
      totalExp += region.expReward;

      // Material drop
      if (enemy.drop && Math.random() < enemy.drop.chance) {
        droppedMaterials[enemy.drop.id] = (droppedMaterials[enemy.drop.id] ?? 0) + 1;
      }

      // Spawn next enemy immediately, reset debuffs
      enemy = pickEnemy(region);
      enemyHp = enemy.hp;
      enemySpdDebuffTurns = 0;
      enemySpdDebuffAmount = 0;
      enemyDotStacks = 0;
      enemyAtkDebuffTurns = 0;
      enemyDefDebuffTurns = 0;
      executeHitCount = 0;

      // 죽음의 무도: 처치 시 즉시 추가 공격 (새 적에게)
      if (onKillExtraAttacks > 0 && enemyHp > 0) {
        const newEnemyDodge = dodgeChance(enemy.agi);
        for (let c = 0; c < onKillExtraAttacks; c++) {
          if (Math.random() < newEnemyDodge) {
            dodgesByEnemy++;
            continue;
          }
          const useMagicBasic = magicBasicIntMult > 0;
          const dmg = useMagicBasic
            ? computePlayerMagicBasicDamage(effInt, magicBasicIntMult, enemy.mdef, {
                damageAmpPct: turnDmgAmpPct,
                magicDmgAmpPct,
                defPiercePct: extraDefPiercePct,
              })
            : computePlayerDamage(stats.atk, enemy.def, passive, {
                atkBoostPct: turnAtkBoostPct,
                damageAmpPct: turnDmgAmpPct,
                extraCritChance,
                defPiercePct: extraDefPiercePct,
              });
          enemyHp -= dmg;
          totalDmgDealt += dmg;
          if (useMagicBasic) magicBasicDealtThisTurn += dmg;
          else if (physicalDealtThisTurn !== undefined) physicalDealtThisTurn += dmg;
          if (enemyHp <= 0) break;
        }
        // 추가 공격으로 처치한 경우 — 단순 처리 (kill 누적, 다음 턴부터 새 적)
        if (enemyHp <= 0) {
          killCounts[enemy.name] = (killCounts[enemy.name] ?? 0) + 1;
          totalKills++;
          gained.gold =
            (gained.gold ?? 0) + randInt(region.drops.gold?.[0] ?? 0, region.drops.gold?.[1] ?? 0);
          gained.iron =
            (gained.iron ?? 0) + randInt(region.drops.iron?.[0] ?? 0, region.drops.iron?.[1] ?? 0);
          totalExp += region.expReward;
          if (enemy.drop && Math.random() < enemy.drop.chance) {
            droppedMaterials[enemy.drop.id] = (droppedMaterials[enemy.drop.id] ?? 0) + 1;
          }
          enemy = pickEnemy(region);
          enemyHp = enemy.hp;
        }
      }

      // Time still passes for this turn
      timeLeft--;
      if (healPerTurnPct > 0) pHp = Math.min(stats.maxHp, pHp + stats.maxHp * healPerTurnPct);
      log.push({
        turn: totalTurns,
        text: turnEvents.join(" · ") || "—",
        playerHpAfter: Math.floor(pHp),
        elements: [...elementState.stacks],
        elementLingerTurns: elementState.lingerTurnsLeft,
      });
      continue;
    }

    // Apply stun (skip enemy turn)
    if (stunOnFire > 0) {
      stunnedTurns = stunOnFire;
    }

    // 플레이어가 먼저 행동했다면 여기서 적 차례
    if (!enemyHandled) {
      runEnemyPhase();
    }

    if (pHp <= 0) {
      diedEarly = true;
      turnEvents.push(`💀 사망`);
      log.push({ turn: totalTurns, text: turnEvents.join(" · ") || "—", playerHpAfter: 0 });
      break;
    }

    // Decrement debuff timers
    if (enemySpdDebuffTurns > 0) enemySpdDebuffTurns--;
    if (enemyAtkDebuffTurns > 0) enemyAtkDebuffTurns--;
    if (enemyDefDebuffTurns > 0) enemyDefDebuffTurns--;
    if (selfAtkBuffTurnsLeft > 0) selfAtkBuffTurnsLeft--;
    if (reflectBoostTurnsLeft > 0) reflectBoostTurnsLeft--;

    // heal_per_turn 패시브 (초재생)
    if (healPerTurnPct > 0) pHp = Math.min(stats.maxHp, pHp + stats.maxHp * healPerTurnPct);
    // 숙소 회복 — 매 턴(=1초)마다 적용
    if (innRegenPerTurn > 0 && pHp > 0) {
      pHp = Math.min(stats.maxHp, pHp + innRegenPerTurn);
    }
    timeLeft--;
    log.push({
      turn: totalTurns,
      text: turnEvents.join(" · ") || "—",
      playerHpAfter: Math.floor(pHp),
    });
  }

  // 적 처치만으로 누적된 raw 값 스냅샷 (treasure/finalMult 적용 전) — cancel 부분 보상 계산용.
  const killsGoldRaw = gained.gold ?? 0;
  const killsIronRaw = gained.iron ?? 0;
  const killsExpRaw = totalExp;
  const killsMaterialsRaw: Materials = { ...droppedMaterials };

  // Treasure rolls (TREASURE_ROLL_PERIOD_SEC당 1회 독립 시행, 적어도 1킬이 있을 때만)
  // 길이별 보물 효율 곡선이 per-kill 효율(DISPATCH_REWARD_MULT)과 일치하도록 굴림 횟수만 시간 비례.
  // 페이아웃은 finalMult를 통해 자연스럽게 효율 곡선이 입혀짐.
  const treasureRolls: number[] = [];
  let treasureHits = 0;
  if (totalKills > 0 && region.treasure) {
    const rollCount = Math.max(1, Math.floor(durationSec / TREASURE_ROLL_PERIOD_SEC));
    for (let i = 0; i < rollCount; i++) {
      const r = Math.random();
      treasureRolls.push(r);
      if (r < region.treasure.chance) treasureHits++;
    }
    if (treasureHits > 0) {
      const t = region.treasure;
      if (t.gold) gained.gold = (gained.gold ?? 0) + t.gold * treasureHits;
      if (t.iron) gained.iron = (gained.iron ?? 0) + t.iron * treasureHits;
      if (t.materials) {
        for (const [k, v] of Object.entries(t.materials)) {
          droppedMaterials[k as keyof Materials] =
            (droppedMaterials[k as keyof Materials] ?? 0) + (v ?? 0) * treasureHits;
        }
      }
    }
  }
  const treasure: Treasure | null = treasureHits > 0 ? region.treasure! : null;

  // Apply reward multipliers (guild + duration penalty + test boost)
  const guildMult = Math.min(1.5, 1 + guild.reputation * 0.0005);
  // 구버전 durationSec(10/30/300/28800 등) 잔존 안전장치 — 미정의 시 1.0.
  // 28800은 한때 존재했으므로 진행 중인 세이브에 한해 1.0으로 자연 정산되도록 의도적으로 두 단계.
  const durationMult = DISPATCH_REWARD_MULT[durationSec] ?? 1.0;
  const finalMult = guildMult * durationMult * TEST_REWARD_MULT;

  if (gained.gold) gained.gold = Math.floor(gained.gold * finalMult);
  if (gained.iron) gained.iron = Math.floor(gained.iron * finalMult);
  totalExp = Math.floor(totalExp * durationMult * TEST_REWARD_MULT);

  const kills = Object.entries(killCounts).map(([name, count]) => ({ name, count }));

  // 현재 최대 길이(2시간 = 7,200턴)까지는 트림 없이 풀 로그 보존 — 트림 시
  // 후반 N턴만 남아 표시 턴 번호가 1300/6300처럼 큰 값에서 시작해 혼란을 유발했다.
  // 폐기된 8시간 세이브 잔존 대비로 cap만 7200에 둠(28,800턴 케이스에서만 트림).
  const LOG_CAP = 7200;
  const trimmedLog = log.length > LOG_CAP ? log.slice(-LOG_CAP) : log;

  // 분당 HP 스냅샷 — 트림 전 풀 로그에서 추출 (turn 60, 120, ..., totalTurns 이내).
  const hpAtMinute: number[] = [];
  for (let i = 59; i < log.length; i += 60) {
    hpAtMinute.push(log[i].playerHpAfter);
  }

  return {
    className,
    durationSec,
    kills,
    totalKills,
    totalTurns,
    damageDealt: totalDmgDealt,
    damageTaken: totalDmgTaken,
    dodgesByPlayer,
    dodgesByEnemy,
    skillActivations,
    finalHp: Math.max(0, pHp),
    diedEarly,
    gained,
    exp: totalExp,
    droppedMaterials,
    treasure,
    treasureHits,
    treasureRolls,
    killsGoldRaw,
    killsIronRaw,
    killsExpRaw,
    killsMaterialsRaw,
    hpAtMinute,
    log: trimmedLog,
    maxSingleHit,
  };
};
