import type { CharacterClass, AdvancedClassId } from "./classes";

export type SkillId =
  // 1차 전사
  | "shield_bash"
  | "smash"
  | "berserker_rage"
  | "berserk"
  | "reflect"
  // 1차 도적
  | "shadow_strike"
  | "evasive_stance"
  | "swiftness"
  | "assassin_instinct"
  // 1차 마법사
  | "mana_orb"
  | "arcane_affinity"
  | "frost_bind"
  | "elemental_acceleration"
  // 1차 후반 (Lv 35-100)
  | "iron_wall"
  | "berserker_cry"
  | "thunder_strike"
  | "immortal_will"
  | "poison_dagger"
  | "poison_blade"
  | "shadow_step"
  | "chain_dagger"
  | "assassinate"
  | "frost_armor"
  | "soul_drain"
  | "chain_lightning"
  | "meteor_strike"
  // 2차 광전사
  | "blood_battle"
  | "frenzy_burst"
  | "dance_of_death"
  | "hell_cry"
  // 2차 수호기사
  | "provoke"
  | "spike_aura"
  | "counter_amp"
  | "clutch_heal"
  // 2차 어쌔신
  | "pitch_black_dagger"
  | "death_sentence"
  | "shadow_clone"
  | "shadowless_kick"
  // 2차 맹독술사
  | "venom_spray"
  | "venom_amp"
  | "decay_touch"
  | "death_mist"
  // 2차 원소술사 (24-elementalist-concept-redesign-plan.md)
  | "fire_element"
  | "ice_element"
  | "lightning_element"
  | "elemental_combo";

// === 원소술사 (24 plan) ===
export type ElementKind = "fire" | "ice" | "lightning";

export type ElementBuff = {
  intPct?: number;
  defPct?: number;
  mdefPct?: number;
  spdFlat?: number;
  dmgReductionPct?: number;
  magicCritChance?: number;
  turnStartMagicMult?: number;
};

export type ElementState = {
  stacks: ElementKind[];
  lingeringBuff: ElementBuff | null;
  lingerTurnsLeft: number;
};

export type SkillTrigger = { kind: "every_n_turns"; n: number } | { kind: "passive" };

export type SkillEffect =
  // 기존 (3개는 옵션 필드 확장됨)
  | {
      kind: "extra_damage_with_stun";
      mult: number;
      stunTurns: number;
      // 확장: DEF 무시 비율 (0~1), 자기 HP 소모 비율
      defPiercePct?: number;
      selfHpCostPct?: number;
      // 광전사 — 소모한 HP(maxHp×selfHpCostPct)만큼 평타에 flat 데미지 합산
      addHpCostAsDamage?: boolean;
    }
  | { kind: "atk_boost"; pct: number }
  | { kind: "guaranteed_crit"; mult: number }
  | { kind: "dodge_boost"; flat: number }
  | {
      kind: "magic_damage";
      intMult: number;
      // 확장: 다단히트, MDEF 무시, DEF 무시 (모든 방어 무시)
      hits?: number;
      ignoreMdef?: boolean;
      ignoreDef?: boolean;
      // 화염구 등 — 즉발 데미지 + 화상 DOT 스택 부여
      dotStacks?: number;
    }
  | { kind: "damage_amplify"; pct: number }
  | { kind: "damage_reduction"; pct: number }
  // 수호의 맹세 — 피격 시 DEF×defMult 반사 (방패병 shield_reflect와 가산)
  | { kind: "reflect_on_hit"; defMult: number }
  | { kind: "crit_chance_boost"; chance: number }
  | {
      kind: "bonus_attacks";
      count: number;
      // 확장: 추가 공격을 모두 보장 크리로
      guaranteedCrit?: boolean;
    }
  | { kind: "magic_damage_with_spd_debuff"; intMult: number; spdAmount: number; spdTurns: number }
  | { kind: "magic_damage_amp"; pct: number }
  // 신규 — 패시브 (9)
  | {
      kind: "flat_stat";
      atk?: number;
      def?: number;
      mdef?: number;
      spd?: number;
      agi?: number;
      int?: number;
      hp?: number;
      dodgePct?: number;
    }
  | {
      kind: "conditional_modifier";
      trigger: "hp_below_pct" | "vs_boss";
      threshold?: number;
      atkPct?: number;
      dmgAmpPct?: number;
      spdFlat?: number;
    }
  | { kind: "lifesteal"; source: "physical" | "magic"; pct: number }
  | { kind: "heal_per_turn"; pct: number }
  | { kind: "def_pierce"; pct: number }
  | {
      kind: "dodge_reaction";
      reactionType: "counter_attack" | "next_hit_mult";
      value: number;
      dodgeFlat?: number;
    }
  | { kind: "on_kill_extra_attack"; count: number }
  | { kind: "revive_once"; triggerHpPct: number; restoreHpPct: number }
  | { kind: "turn_start_magic"; intMult: number }
  // 신규 — 발동형 (4)
  | {
      kind: "apply_dot";
      stackCount: number;
      stunTurns?: number;
      // 죽음의 안개 — 발동 후 N턴 동안 매 턴 시작 시 +stack
      lingerPerTurn?: number;
      lingerTurns?: number;
      // 독액 살포 — 발동 후 N턴 동안 받는 DOT 데미지 +pct
      ampBoostPct?: number;
      ampBoostTurns?: number;
    }
  | { kind: "self_heal"; pct: number }
  | {
      kind: "enemy_debuff";
      stat: "atk" | "def" | "mdef" | "spd";
      pct?: number;
      flat?: number;
      turns: number;
    }
  // 신규 — 특수 (1)
  | {
      kind: "enemy_hp_pct_damage";
      pct: number;
      cap?: number;
      bossOnly: boolean;
      coopBossExempt?: boolean;
    }
  // 패시브 도트 증폭 (가하는 도트 데미지 +pct, 스택)
  | { kind: "dot_amp"; pct: number }
  // 맹독 폭발 — 독 스택이 캡 도달 시 자동 폭발: stacks × INT × intMultPerStack 데미지, 스택 0
  | { kind: "dot_burst"; intMultPerStack: number }
  // 부패의 손길 — 기본 공격 적중 시 독 스택 +N
  | { kind: "dot_on_hit"; stacks: number }
  // 방패 강타 — N턴마다 DEF*defMult 데미지 (방어 무시)
  | { kind: "shield_strike"; defMult: number }
  // 패시브 % 스탯 증가 (base+flat 합에 % 곱)
  | {
      kind: "stat_pct_boost";
      atkPct?: number;
      defPct?: number;
      mdefPct?: number;
      spdPct?: number;
      agiPct?: number;
      intPct?: number;
      hpPct?: number;
    }
  // 광기의 외침 — 발동 시 자기 HP 소모 + N턴간 ATK +pct
  | { kind: "self_atk_buff"; atkPct: number; turns: number; selfHpCostPct?: number }
  // 도발 — 발동 시 즉시 적 공격 N회 추가 유도
  | { kind: "taunt"; extraEnemyAttacks: number }
  // 가시 오라 — 패시브, 매 턴 적에게 DEF*defMult 데미지
  | { kind: "thorn_aura"; defMult: number }
  // 반격 강화 — 발동 시 N턴간 반사 비율 +pct
  | { kind: "reflect_boost"; pct: number; turns: number }
  // 연속 찌르기 — 모든 물리 공격(평타/데미지 스킬) 적중 시 데미지의 pct만큼 추가 공격
  | { kind: "follow_up_attack"; pct: number }
  // 사형 선고 — 적에게 데미지 N회 누적 시 적 최대 HP의 maxHpPct 데미지 (카운터 리셋)
  | { kind: "execute_on_hits"; hits: number; maxHpPct: number }
  // 마력구체 — 패시브, 기본 공격을 ATK 기반에서 INT×intMult 마법 데미지로 대체 (vs MDEF, def_pierce 적용)
  | { kind: "magic_basic_attack"; intMult: number }
  // 얼음 방패 — 발동 시 INT×intMult 만큼 쉴드 획득. 피격 시 쉴드가 데미지 우선 흡수 (HP 차감 전).
  // 재시전은 새 값으로 덮어씀(스택 X). 쉴드는 소진될 때까지 지속.
  | { kind: "shield_absorb"; intMult: number }
  // 마력 환류 — 패시브, 마법 N번 시전마다 다음 마법 데미지 +bonusPct (카운터 전투 한정).
  // 카운트 대상: 데미지 발생하는 마법 스킬(magic_damage / magic_damage_with_spd_debuff / elemental_combo).
  // mana_orb 기본 공격은 카운트하지 않음.
  | { kind: "magic_condensation"; everyN: number; bonusPct: number }
  // 원소 부여 (24 plan) — 즉발 데미지 0, 자기 스택 +1 (cap 3, FIFO push out). 얼음만 적 SPD 디버프 동반.
  | {
      kind: "apply_element";
      element: ElementKind;
      enemyDebuff?: { stat: "spd"; flat: number; turns: number };
    }
  // 원소 조합 (24 plan) — 보유 원소 종류 set으로 7가지 콤보 분기. 발동 시 스택 소비 + 자기 버프 잔존.
  | { kind: "elemental_combo" };

export type SkillDef = {
  id: SkillId;
  name: string;
  description: string;
  classId: CharacterClass | AdvancedClassId;
  unlockLevel: number;
  trigger: SkillTrigger;
  effect: SkillEffect;
  // 2차 직업 스킬은 학습 필요 (skillExp 차감). 1차 스킬은 undefined
  learnCost?: number;
};

export const BASE_MAX_EQUIPPED_SKILLS = 5;
export const ADVANCED_BONUS_SKILL_SLOTS = 1;
// 하위 호환용 (기본값). 실제 캐릭터별 한도는 getMaxEquippedSkills 사용.
export const MAX_EQUIPPED_SKILLS = BASE_MAX_EQUIPPED_SKILLS;
