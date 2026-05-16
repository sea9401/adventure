// PvP 전투 엔진 — engine.ts (PvE) 의 대칭 미러. PR-1a (공격자 측).
//
// 시리즈:
//   PR-1a (이 파일) — 구조·타입·이니셜·resolve 루프 + 공격자 측 능력 전부.
//   PR-1b (예정)   — 방어자 측 능력 전부 (가드/철벽/불굴/그림자보법/회피강화/행운의방패/
//                  곡예/반사갑주/가시갑옷/무한가시/반사회피/유격/반격/굳건한의지/흡혈갑옷/
//                  반격의룬). advanceTurnPvP 본체를 한 번 더 크게 보강.
//
// 차이점 (engine.ts 와):
//   - 양쪽 모두 PlayerCombat (Monster 없음). 두 사이드를 p1/p2 로 보관.
//   - Monster 전용 개념(phaseTrigger / 잡몹 skill heavy_blow|enrage|brace|pierce /
//     armorVulnerable / playerDefVulnerable) 은 제거. 두 플레이어의 특기·룬·포션은
//     양쪽 모두에 대칭으로 적용.
//   - state.enemy.X → defender.player.X (현재 페이즈에서 방어자 측)
//   - state.buffs/flags/stacks/turn → attacker.buffs/flags/stacks/turn (현재 페이즈에서 공격자 측)
//   - 출혈 도트는 "공격자가 상대에게 쌓아둔 스택" 으로 attacker.stacks.bleedStacksOnOpponent 에 보관.
//     상대(defender) 턴 시작 시, attacker(=직전 페이즈에서 공격자였던 쪽) 의 bleedDmgPerStack 으로 도트 데미지.
//   - 양쪽 모두 HP 0 → 무승부 (draw) 가능. resolveBattlePvP 가 처리.
//
// PR-1a 범위 — 공격자 측 능력 (대칭으로 양쪽에 적용):
//   강공격, 분쇄, 암살, 약점적중, 광전사, 질풍검, 불굴의일격, 회전운기, 크리(+ 천칭 + 이중행운
//   + 만물행운), 처형, 행운의별, 천명, 충돌파, 연쇄운명, 연타, 광속, 풍사슬(5)/무한풍사슬(6),
//   연참, 그림자 분신/군단, 무피해 난무, 막다른 격노, 약점 분석, 포션, 흡혈/행운의 흡혈/흡혈의 룬,
//   출혈 dot (방어자 턴 시작 시 적용).
//
// PR-1b 잔여 — 방어자 측 능력 (advanceTurnPvP 본체 보강 시 통합):
//   그림자 보법, 회피 강화(보장 회피), 행운의 방패, 곡예(회피 시 힐), 반사 회피, 유격,
//   반격(counterAtkBonus), 가드, 굳건한 의지, 철벽 보호막 흡수, 불굴(HP 0 방어),
//   흡혈 갑옷, 반사 갑주, 가시 갑옷, 무한 가시 반사, 반격의 룬.
//   (현재 PR-1a 본체는 공격자가 가하는 totalDmg 를 방어자 hp 에 *그대로* 차감 — 위 방어자
//    측 능력이 없는 상태에서의 1차 대칭 검증용. PR-1b 가 데미지 적용 직전·직후의 방어자 측
//    처리를 위빙해 넣는다.)
//
// 재사용:
//   - PlayerCombat / PlayerAction / BattleLogEntry / damageBetween / BattleTurnState 는
//     engine.ts 에서 import (단일 진실 공급원).

import {
  type PlayerCombat,
  type PlayerAction,
  type BattleLogEntry,
  type BattleTurnState,
  appendLog,
  damageBetween,
} from "./engine";
import { computeHealAmount, type Potion, type PotionId } from "../data/potions";
import {
  CRIT_MULT_BASE,
  ETERNAL_GALE_ABSOLUTE_CAP,
  GALE_CHAIN_MAX_PER_TURN,
  HEAVEN_DECREE_HP_PCT,
  IMPACT_WAVE_INTERVAL,
  LUCKY_STAR_DAMAGE_MULT,
  POWER_ATTACK_TURN_INTERVAL,
  RAMPAGE_START_TURN,
} from "../character/skills";
import { AP_BATTLE_START, AP_CAP } from "../character/apSkills";

// ── 타입 정의 ───────────────────────────────────────────────────────────────

export type PvPPhase = "p1" | "p2" | "ended";

export type PvPOutcome = "p1_win" | "p2_win" | "draw";

// 각 사이드별 1회성 토글. PvE 의 BattleFlags 와 비교해 Monster 전용(phaseTriggered, enrageTriggered) 제거.
export type PvPSideFlags = {
  enduranceTriggered: boolean;
  assassinateUsed: boolean;
  luckyBuffActive: boolean;
  fatedChainCritPending: boolean;
};

// 각 사이드별 누적 보너스/페널티. PvE 의 BattleBuffs 와 비교해 enemyDefBonus(phase trigger),
// enemyAtkBonus(enrage) 제거. enemyAtkPenalty/enemyDefPenalty 는 opponentAtkPenalty/opponentDefPenalty
// 로 의미 일관화 (이 사이드가 상대에게 적용한 페널티).
export type PvPSideBuffs = {
  rampageAtkBonus: number;
  opponentAtkPenalty: number;
  opponentDefPenalty: number;
  cyclingChiBonus: number;
  potionHealPct: number;
};

// 각 사이드별 가변 자원. bleedStacks → bleedStacksOnOpponent (이 사이드가 상대에게 쌓은 출혈).
export type PvPSideStacks = {
  bleedStacksOnOpponent: number;
  playerShield: number;
  evadesRemaining: number;
  damageTakenThisCombat: number;
  weakpointDefIgnoreLeft: number;
};

export type PvPSide = {
  player: PlayerCombat;
  name: string;
  hp: number;
  maxHp: number;
  attacksLeft: number;
  // 유격 (skirmishNextTurnBonus) — 이 사이드가 회피 성공 시 누적, 다음 자기 공격 페이즈
  // 시작 시 attacksLeft 에 더해지고 0 으로 리셋. PvE 의 enemy phase 내 직접 가산을
  // PvP 에선 페이즈 분리 때문에 별도 슬롯이 필요.
  nextTurnAttackBonus: number;
  // AP 스킬 자원 — 매 공격 행동(명중/회피 무관) +1, cap=AP_CAP. 스킬 발동 시 cost 차감.
  // equippedAPSkills 미장착이면 0 으로 두고 회복/소비 노옵. PvE engine.ts:138 미러.
  ap: number;
  turn: BattleTurnState;
  flags: PvPSideFlags;
  buffs: PvPSideBuffs;
  stacks: PvPSideStacks;
};

export type PvPBattleState = {
  p1: PvPSide;
  p2: PvPSide;
  phase: PvPPhase;
  outcome: PvPOutcome | null;
  log: BattleLogEntry[];
};

// ── 유틸 ────────────────────────────────────────────────────────────────────

// 한 턴의 공격 횟수 — 기본 attackCount + extraAttackChancePct 1회 판정. 6티어 만물 행운 가산.
function rollAttackCount(player: PlayerCombat): number {
  const base = Math.max(1, player.attackCount);
  const luckBonus = player.universalLuckBonusPct ?? 0;
  const chance = (player.extraAttackChancePct ?? 0) + luckBonus;
  if (chance > 0 && Math.random() * 100 < chance) return base + 1;
  return base;
}

// 공격자가 마주하는 방어자의 effective DEF — analysis 누적 페널티(자기 측 buffs 에 기록) 차감.
// armorPierceFraction 비례 관통 적용. 분쇄/암살/약점은 호출 측에서 별도 처리.
function attackerFacingDef(attacker: PvPSide, defender: PvPSide): number {
  const raw = Math.max(
    0,
    defender.player.def - attacker.buffs.opponentDefPenalty,
  );
  const frac = attacker.player.armorPierceFraction ?? 0;
  return frac > 0 ? Math.round(raw * (1 - frac)) : raw;
}

// 공격자가 가하는 effective ATK — analysis 페널티는 방어자 측 buffs 에 기록 (이 사이드의 적이 나에게
// 적용한 페널티). 그래서 effectiveAtk = attacker.atk - defender.buffs.opponentAtkPenalty.
function effectiveAttackerAtk(attacker: PvPSide, defender: PvPSide): number {
  return Math.max(
    0,
    attacker.player.atk +
      attacker.buffs.rampageAtkBonus -
      defender.buffs.opponentAtkPenalty,
  );
}

// 사이드 갱신 헬퍼 — p1 또는 p2 슬롯에 새 사이드 객체 박기.
function setSide(
  state: PvPBattleState,
  which: "p1" | "p2",
  next: PvPSide,
): PvPBattleState {
  return which === "p1" ? { ...state, p1: next } : { ...state, p2: next };
}

// 현 phase 에서 (attacker, defender) 키 결정.
function actorKeys(phase: PvPPhase): { atkKey: "p1" | "p2"; defKey: "p1" | "p2" } {
  if (phase === "p1") return { atkKey: "p1", defKey: "p2" };
  return { atkKey: "p2", defKey: "p1" };
}

// ── 초기화 ──────────────────────────────────────────────────────────────────

function buildSide(player: PlayerCombat, name: string): PvPSide {
  const startShield = player.bulwarkShield ?? 0;
  return {
    player,
    name,
    hp: player.hp,
    maxHp: player.maxHp,
    attacksLeft: 0, // initialBattleStatePvP 에서 선공 측만 채움
    nextTurnAttackBonus: 0,
    ap: (player.equippedAPSkills?.length ?? 0) > 0 ? AP_BATTLE_START : 0,
    turn: {
      completedPlayerTurns: 0,
      enemyPhasesCompleted: 0,
      firstAttackPending: true,
      doubleStrikeUsedThisTurn: false,
      lightspeedUsedThisTurn: false,
      galeChainsThisTurn: 0,
      critThisTurn: false,
      riposteUsedThisTurn: false,
      weakpointUsedThisTurn: false,
      fatedChainTriggeredThisTurn: false,
      apSkillFiredThisTurn: null,
    },
    flags: {
      enduranceTriggered: false,
      assassinateUsed: false,
      luckyBuffActive: false,
      fatedChainCritPending: false,
    },
    buffs: {
      rampageAtkBonus: 0,
      opponentAtkPenalty: 0,
      opponentDefPenalty: 0,
      cyclingChiBonus: 0,
      potionHealPct: player.potionHealPct ?? 0,
    },
    stacks: {
      bleedStacksOnOpponent: 0,
      playerShield: startShield,
      evadesRemaining: player.guaranteedEvades ?? 0,
      damageTakenThisCombat: 0,
      weakpointDefIgnoreLeft: 0,
    },
  };
}

// 선공 — SPD 가 높은 쪽이 먼저. 동점이면 p1 우선.
export function initialBattleStatePvP(
  p1Player: PlayerCombat,
  p2Player: PlayerCombat,
  p1Name: string,
  p2Name: string,
): PvPBattleState {
  const p1Side = buildSide(p1Player, p1Name);
  const p2Side = buildSide(p2Player, p2Name);
  const p1First = p1Player.spd >= p2Player.spd;
  const phase: PvPPhase = p1First ? "p1" : "p2";
  const initiator = p1First ? p1Name : p2Name;
  const log: BattleLogEntry[] = [
    { kind: "info", text: `${p1Name} 와(과) ${p2Name} 가 마주섰다.` },
    { kind: "info", text: `${initiator}의 선공.` },
  ];
  // 선공자 첫 턴 공격 횟수 세팅 + 기습 보너스.
  const firstAttacker = p1First ? p1Side : p2Side;
  const otherSide = p1First ? p2Side : p1Side;
  const vanguardBonus = firstAttacker.player.vanguardFirstTurnBonus ?? 0;
  if (vanguardBonus > 0) {
    log.push({
      kind: "info",
      text: `[기습] ${firstAttacker.name} 첫 턴 추가 공격 ${vanguardBonus}회!`,
    });
  }
  const attackerWithCount: PvPSide = {
    ...firstAttacker,
    attacksLeft: rollAttackCount(firstAttacker.player) + vanguardBonus,
  };
  // 철벽 보호막 알림 — 양쪽 다 표기.
  if (p1Side.stacks.playerShield > 0) {
    log.push({
      kind: "info",
      text: `[철벽] ${p1Side.name} 보호막 ${p1Side.stacks.playerShield} 전개`,
    });
  }
  if (p2Side.stacks.playerShield > 0) {
    log.push({
      kind: "info",
      text: `[철벽] ${p2Side.name} 보호막 ${p2Side.stacks.playerShield} 전개`,
    });
  }
  return {
    p1: p1First ? attackerWithCount : otherSide,
    p2: p1First ? otherSide : attackerWithCount,
    phase,
    outcome: null,
    log,
  };
}

// ── 헬퍼 — 사이드 mutate 패턴들 ────────────────────────────────────────────

// 재생 (regen) — completedPlayerTurns 가 interval 배수일 때 HP +amount.
function applyRegen(state: PvPBattleState, key: "p1" | "p2"): PvPBattleState {
  const side = state[key];
  const r = side.player.regen;
  if (!r || r.interval <= 0 || r.amount <= 0) return state;
  if (side.turn.completedPlayerTurns === 0) return state;
  if (side.turn.completedPlayerTurns % r.interval !== 0) return state;
  if (side.hp >= side.maxHp) return state;
  const newHp = Math.min(side.maxHp, side.hp + r.amount);
  const actual = newHp - side.hp;
  let next = setSide(state, key, { ...side, hp: newHp });
  next = {
    ...next,
    log: appendLog(next.log, {
      kind: "info",
      text: `[재생] ${side.name}의 HP +${actual}`,
    }),
  };
  return next;
}

// 자연회복 (baselineRegen) — 같은 로직, 다른 슬롯.
function applyBaselineRegen(
  state: PvPBattleState,
  key: "p1" | "p2",
): PvPBattleState {
  const side = state[key];
  const r = side.player.baselineRegen;
  if (!r || r.interval <= 0 || r.amount <= 0) return state;
  if (side.turn.completedPlayerTurns === 0) return state;
  if (side.turn.completedPlayerTurns % r.interval !== 0) return state;
  if (side.hp >= side.maxHp) return state;
  const newHp = Math.min(side.maxHp, side.hp + r.amount);
  const actual = newHp - side.hp;
  let next = setSide(state, key, { ...side, hp: newHp });
  next = {
    ...next,
    log: appendLog(next.log, {
      kind: "info",
      text: `[자연회복] ${side.name}의 HP +${actual}`,
    }),
  };
  return next;
}

// 부가 공격 1회 (분신/난무) — 데미지 적용 + 사망 처리. 크리/강공격/기타 미적용.
function dealExtraDamage(
  state: PvPBattleState,
  atkKey: "p1" | "p2",
  defKey: "p1" | "p2",
  dmg: number,
  label: string,
): PvPBattleState {
  const defender = state[defKey];
  const newHp = Math.max(0, defender.hp - dmg);
  let next = setSide(state, defKey, { ...defender, hp: newHp });
  next = {
    ...next,
    log: appendLog(next.log, {
      kind: "player_attack",
      text: `[${label}] ${defender.name}에게 ${dmg} 피해를 입혔다.`,
    }),
  };
  if (newHp <= 0) {
    next = {
      ...next,
      log: appendLog(next.log, {
        kind: "info",
        text: `${defender.name}이(가) 쓰러졌다.`,
      }),
      phase: "ended",
      outcome: atkKey === "p1" ? "p1_win" : "p2_win",
    };
  }
  return next;
}

// ── 방어자 측 dodge 헬퍼 ────────────────────────────────────────────────────

// dodge 한 번에 발생하는 효과들 — 곡예(힐) → 보장 회피 소비(옵션) → 무한 가시 + 반사 회피
// → 반격(counterAtkBonus) → 유격(skirmishNextTurnBonus 누적). 어느 단계에서 공격자가 죽으면
// phase=ended 로 종료. 호출 측은 ended 여부 확인 후 attacksLeft 차감 또는 phase 종료를 결정.
function applyDodgeEffects(
  state: PvPBattleState,
  atkKey: "p1" | "p2",
  defKey: "p1" | "p2",
  dodgeLogText: string,
  consumeEvade: boolean,
): PvPBattleState {
  let st: PvPBattleState = {
    ...state,
    log: appendLog(state.log, { kind: "info", text: dodgeLogText }),
  };
  if (st.phase === "ended") return st;
  // 곡예 — 회피 성공 시 HP +amount.
  const defForHeal = st[defKey];
  const evadeHeal = defForHeal.player.evadeHealAmount ?? 0;
  if (evadeHeal > 0 && defForHeal.hp < defForHeal.maxHp) {
    const newHp = Math.min(defForHeal.maxHp, defForHeal.hp + evadeHeal);
    const actual = newHp - defForHeal.hp;
    st = setSide(st, defKey, { ...defForHeal, hp: newHp });
    st = {
      ...st,
      log: appendLog(st.log, {
        kind: "info",
        text: `[곡예] ${defForHeal.name}의 HP +${actual}`,
      }),
    };
  }
  // 보장 회피 소비 (회피 강화 분기에서만).
  if (consumeEvade) {
    const d = st[defKey];
    if (d.stacks.evadesRemaining > 0) {
      st = setSide(st, defKey, {
        ...d,
        stacks: {
          ...d.stacks,
          evadesRemaining: d.stacks.evadesRemaining - 1,
        },
      });
    }
  }
  // 무한 가시 + 반사 회피 — 적 ATK 기반 / 추정 raw 데미지 기반 반사.
  const attackerNow = st[atkKey];
  const defenderNow = st[defKey];
  const infiniteThornsPct = defenderNow.player.infiniteThornsAtkPct ?? 0;
  const infiniteThornsDmg =
    infiniteThornsPct > 0
      ? Math.floor((attackerNow.player.atk * infiniteThornsPct) / 100)
      : 0;
  const reflexEvadeMult = defenderNow.player.reflexEvadeMult ?? 0;
  const estimatedRawDmg =
    reflexEvadeMult > 0
      ? damageBetween(
          effectiveAttackerAtk(attackerNow, defenderNow),
          defenderNow.player.def,
        )
      : 0;
  const reflexEvadeDmg =
    reflexEvadeMult > 0 ? Math.floor(estimatedRawDmg * reflexEvadeMult) : 0;
  const totalReflect = infiniteThornsDmg + reflexEvadeDmg;
  if (totalReflect > 0) {
    const newAtkHp = Math.max(0, attackerNow.hp - totalReflect);
    st = setSide(st, atkKey, { ...attackerNow, hp: newAtkHp });
    const labels: string[] = [];
    if (infiniteThornsDmg > 0) labels.push("무한 가시");
    if (reflexEvadeDmg > 0) labels.push("반사 회피");
    st = {
      ...st,
      log: appendLog(st.log, {
        kind: "player_attack",
        text: `[${labels.join(" + ")}] ${attackerNow.name}에게 ${totalReflect} 반사 피해.`,
      }),
    };
    if (newAtkHp <= 0) {
      return {
        ...st,
        log: appendLog(st.log, {
          kind: "info",
          text: `${attackerNow.name}이(가) 쓰러졌다.`,
        }),
        phase: "ended",
        outcome: defKey === "p1" ? "p1_win" : "p2_win",
      };
    }
  }
  // 반격 (counterAtkBonus) — 회피 성공 시 ATK + bonus 데미지로 카운터 1회.
  const attackerAfterReflect = st[atkKey];
  const counterBonus = defenderNow.player.counterAtkBonus ?? 0;
  if (counterBonus > 0) {
    const counterDmg = damageBetween(
      defenderNow.player.atk + counterBonus,
      attackerAfterReflect.player.def,
    );
    const newAtkHp = Math.max(0, attackerAfterReflect.hp - counterDmg);
    st = setSide(st, atkKey, { ...attackerAfterReflect, hp: newAtkHp });
    st = {
      ...st,
      log: appendLog(st.log, {
        kind: "player_attack",
        text: `[반격] ${attackerAfterReflect.name}에게 ${counterDmg} 피해.`,
      }),
    };
    if (newAtkHp <= 0) {
      return {
        ...st,
        log: appendLog(st.log, {
          kind: "info",
          text: `${attackerAfterReflect.name}이(가) 쓰러졌다.`,
        }),
        phase: "ended",
        outcome: defKey === "p1" ? "p1_win" : "p2_win",
      };
    }
  }
  // 유격 — 회피 성공 시 다음 자기 페이즈 공격 횟수 +N (nextTurnAttackBonus 에 누적).
  const skirmishBonus = defenderNow.player.skirmishNextTurnBonus ?? 0;
  if (skirmishBonus > 0) {
    const d = st[defKey];
    st = setSide(st, defKey, {
      ...d,
      nextTurnAttackBonus: d.nextTurnAttackBonus + skirmishBonus,
    });
  }
  return st;
}

// 회피된 attacker 의 AP +1 (행동 시도는 명중/회피 무관히 +1). engine.ts:687 미러.
// equippedAPSkills 없으면 ap=0 유지로 무해. 회피 시 apSkillFires 는 발동/소비 안 함.
function bumpAttackerAp(state: PvPBattleState, atkKey: "p1" | "p2"): PvPBattleState {
  const a = state[atkKey];
  return setSide(state, atkKey, { ...a, ap: Math.min(AP_CAP, a.ap + 1) });
}

// shadowStep dodge — 한 페이즈 통째로 회피 + dodge 효과 + 페이즈 종료.
function applyShadowStepDodge(
  state: PvPBattleState,
  atkKey: "p1" | "p2",
  defKey: "p1" | "p2",
): PvPBattleState {
  const defender = state[defKey];
  const dodged = applyDodgeEffects(
    bumpAttackerAp(state, atkKey),
    atkKey,
    defKey,
    `[그림자 보법] ${defender.name}이(가) 모든 공격을 그림자처럼 흘려보냈다!`,
    false,
  );
  if (dodged.phase === "ended") return dodged;
  return endAttackerPhase(dodged, atkKey, defKey);
}

// per-attack dodge — dodge 효과 + 공격 횟수 1 차감. attacksLeft 0 이면 페이즈 종료.
function applyPerAttackDodge(
  state: PvPBattleState,
  atkKey: "p1" | "p2",
  defKey: "p1" | "p2",
  logText: string,
  consumeEvade: boolean,
): PvPBattleState {
  const dodged = applyDodgeEffects(
    bumpAttackerAp(state, atkKey),
    atkKey,
    defKey,
    logText,
    consumeEvade,
  );
  if (dodged.phase === "ended") return dodged;
  const attacker = dodged[atkKey];
  const newAttacksLeft = attacker.attacksLeft - 1;
  if (newAttacksLeft > 0) {
    return setSide(dodged, atkKey, {
      ...attacker,
      attacksLeft: newAttacksLeft,
      turn: { ...attacker.turn, firstAttackPending: false },
    });
  }
  return endAttackerPhase(dodged, atkKey, defKey);
}

// 데미지 적중 시 반사 (반사 갑주 + 가시 갑옷 + 무한 가시). 공격자가 죽으면 attackerKilled=true.
function applyOnHitReflect(
  state: PvPBattleState,
  atkKey: "p1" | "p2",
  defKey: "p1" | "p2",
  damageTakenToHp: number,
): { state: PvPBattleState; attackerKilled: boolean } {
  const attacker = state[atkKey];
  const defender = state[defKey];
  const thornsPct = defender.player.thornsPct ?? 0;
  const thornsDmg =
    thornsPct > 0 ? Math.floor((damageTakenToHp * thornsPct) / 100) : 0;
  const bramblePct = defender.player.bramblePct ?? 0;
  const brambleDmg =
    bramblePct > 0 ? Math.floor((damageTakenToHp * bramblePct) / 100) : 0;
  const infinitePct = defender.player.infiniteThornsAtkPct ?? 0;
  const infiniteDmg =
    infinitePct > 0 ? Math.floor((attacker.player.atk * infinitePct) / 100) : 0;
  const total = thornsDmg + brambleDmg + infiniteDmg;
  if (total <= 0) return { state, attackerKilled: false };
  const newAtkHp = Math.max(0, attacker.hp - total);
  let st = setSide(state, atkKey, { ...attacker, hp: newAtkHp });
  const labels: string[] = [];
  if (thornsDmg > 0) labels.push("반사 갑주");
  if (brambleDmg > 0) labels.push("가시 갑옷");
  if (infiniteDmg > 0) labels.push("무한 가시");
  st = {
    ...st,
    log: appendLog(st.log, {
      kind: "player_attack",
      text: `[${labels.join(" + ")}] ${attacker.name}에게 ${total} 반사 피해.`,
    }),
  };
  if (newAtkHp <= 0) {
    st = {
      ...st,
      log: appendLog(st.log, {
        kind: "info",
        text: `${attacker.name}이(가) 쓰러졌다.`,
      }),
      phase: "ended",
      outcome: defKey === "p1" ? "p1_win" : "p2_win",
    };
    return { state: st, attackerKilled: true };
  }
  return { state: st, attackerKilled: false };
}

// 반격의 룬 — 피격 후 일정 확률로 카운터 1회 (ATK 데미지). 공격자가 죽으면 attackerKilled=true.
function maybeApplyRuneCounter(
  state: PvPBattleState,
  atkKey: "p1" | "p2",
  defKey: "p1" | "p2",
): { state: PvPBattleState; attackerKilled: boolean } {
  const defender = state[defKey];
  const attacker = state[atkKey];
  const pct = defender.player.runeCounterChancePct ?? 0;
  if (pct <= 0 || Math.random() * 100 >= pct) {
    return { state, attackerKilled: false };
  }
  const dmg = damageBetween(
    effectiveAttackerAtk(defender, attacker),
    attackerFacingDef(defender, attacker),
  );
  const newAtkHp = Math.max(0, attacker.hp - dmg);
  let st = setSide(state, atkKey, { ...attacker, hp: newAtkHp });
  st = {
    ...st,
    log: appendLog(st.log, {
      kind: "player_attack",
      text: `[반격의 룬] ${attacker.name}에게 ${dmg} 반격 피해.`,
    }),
  };
  if (newAtkHp <= 0) {
    st = {
      ...st,
      log: appendLog(st.log, {
        kind: "info",
        text: `${attacker.name}이(가) 쓰러졌다.`,
      }),
      phase: "ended",
      outcome: defKey === "p1" ? "p1_win" : "p2_win",
    };
    return { state: st, attackerKilled: true };
  }
  return { state: st, attackerKilled: false };
}

// 공격 턴 종료 후 처리 — 그림자 분신 → 무피해 난무 → 막다른 격노 → 약점 분석 → 재생/자연회복.
// PvE 의 finishPlayerTurn 미러.
function finishAttackerTurn(
  state: PvPBattleState,
  atkKey: "p1" | "p2",
  defKey: "p1" | "p2",
): PvPBattleState {
  let st = state;
  const attacker = st[atkKey];
  // 그림자 분신 + 6티어 군단.
  const clonePct = attacker.player.shadowCloneAtkPct ?? 0;
  const cloneExtra = attacker.player.shadowLegionExtraClones ?? 0;
  const cloneCount = clonePct > 0 ? 1 + cloneExtra : 0;
  if (st.phase !== "ended" && cloneCount > 0) {
    for (let i = 0; i < cloneCount; i += 1) {
      if (st.phase === "ended") break;
      const atk = st[atkKey];
      const def = st[defKey];
      const cloneDmg = damageBetween(
        Math.floor((atk.player.atk * clonePct) / 100),
        attackerFacingDef(atk, def),
      );
      st = dealExtraDamage(
        st,
        atkKey,
        defKey,
        cloneDmg,
        cloneExtra > 0 ? "그림자 군단" : "그림자 분신",
      );
    }
  }
  // 무피해 난무.
  const attackerAfter = st[atkKey];
  const flurry = attackerAfter.player.flurryAttacks ?? 0;
  if (
    st.phase !== "ended" &&
    flurry > 0 &&
    attackerAfter.stacks.damageTakenThisCombat === 0
  ) {
    for (let i = 0; i < flurry; i += 1) {
      if (st.phase === "ended") break;
      const atk = st[atkKey];
      const def = st[defKey];
      const fd = damageBetween(
        effectiveAttackerAtk(atk, def),
        attackerFacingDef(atk, def),
      );
      st = dealExtraDamage(st, atkKey, defKey, fd, "무피해 난무");
    }
  }
  if (st.phase === "ended") return st;
  // 막다른 격노 (5티어) — completedPlayerTurns >= RAMPAGE_START_TURN 후, 매 턴 종료 시 ATK 누적.
  const rampage = st[atkKey].player.rampagePerTurn ?? 0;
  if (rampage > 0 && st[atkKey].turn.completedPlayerTurns >= RAMPAGE_START_TURN) {
    const side = st[atkKey];
    const nextBonus = side.buffs.rampageAtkBonus + rampage;
    st = setSide(st, atkKey, {
      ...side,
      buffs: { ...side.buffs, rampageAtkBonus: nextBonus },
    });
    st = {
      ...st,
      log: appendLog(st.log, {
        kind: "info",
        text: `[막다른 격노] ${side.name} ATK +${rampage} (누적 +${nextBonus})`,
      }),
    };
  }
  // 약점 분석 (5티어) — 매 턴 종료 시 상대 ATK/DEF 페널티 +N (자기 buffs 에 기록).
  const analysis = st[atkKey].player.analysisPerTurn ?? 0;
  if (analysis > 0) {
    const side = st[atkKey];
    const nextAtkPen = side.buffs.opponentAtkPenalty + analysis;
    const nextDefPen = side.buffs.opponentDefPenalty + analysis;
    st = setSide(st, atkKey, {
      ...side,
      buffs: {
        ...side.buffs,
        opponentAtkPenalty: nextAtkPen,
        opponentDefPenalty: nextDefPen,
      },
    });
    st = {
      ...st,
      log: appendLog(st.log, {
        kind: "info",
        text: `[약점 분석] ${st[defKey].name} ATK·DEF -${analysis} (누적 -${nextAtkPen}/-${nextDefPen})`,
      }),
    };
  }
  st = applyBaselineRegen(st, atkKey);
  st = applyRegen(st, atkKey);
  return st;
}

// ── 메인 advanceTurn ─────────────────────────────────────────────────────────

export function advanceTurnPvP(
  state: PvPBattleState,
  action: PlayerAction = { kind: "attack" },
): PvPBattleState {
  if (state.phase === "ended") return state;
  const { atkKey, defKey } = actorKeys(state.phase);

  // ── 공격 페이즈 ──────────────────────────────────────────────────────────
  // 공격자의 모든 공격을 처리 → 마지막 공격 후 연타/광속/풍사슬/연참 체크 → 끝나면 상대 페이즈로.
  // 포션 사용은 한 번 마시고 즉시 페이즈 종료.

  if (action.kind === "use_potion") {
    let st = applyPotionTo(state, atkKey, action.potion);
    const a = st[atkKey];
    st = setSide(st, atkKey, {
      ...a,
      attacksLeft: rollAttackCount(a.player),
      turn: { ...a.turn, firstAttackPending: true },
    });
    return endAttackerPhase(st, atkKey, defKey);
  }

  const attacker = state[atkKey];
  const defender = state[defKey];

  // 강공격 — POWER_ATTACK_TURN_INTERVAL 턴마다 첫 공격에 ATK + powerAttackBonus.
  const turnNumber = attacker.turn.completedPlayerTurns + 1;
  const isFirstAttackOfTurn = attacker.turn.firstAttackPending;
  const powerBonus =
    isFirstAttackOfTurn &&
    turnNumber % POWER_ATTACK_TURN_INTERVAL === 0 &&
    (attacker.player.powerAttackBonus ?? 0) > 0
      ? attacker.player.powerAttackBonus!
      : 0;

  // AP 스킬 — 그 턴 첫 공격일 때만 슬롯 순서로 cost<=AP 인 첫 1개 발동. 한 턴 1개 정책.
  // engine.ts:651-669 의 PvP 미러 (atkMult/ignoresDef/ignoresEvasion). 강공격과 동시 발동 가능.
  const apSkillFires =
    isFirstAttackOfTurn &&
    attacker.turn.apSkillFiredThisTurn === null &&
    (attacker.player.equippedAPSkills?.length ?? 0) > 0
      ? attacker.player.equippedAPSkills!.find((s) => s.apCost <= attacker.ap) ??
        null
      : null;
  const apAtkMult =
    apSkillFires?.effect.kind === "atk_multiplier"
      ? apSkillFires.effect.atkMult
      : 1;
  const apIgnoresDef =
    apSkillFires?.effect.kind === "atk_multiplier" &&
    apSkillFires.effect.ignoresDef === true;
  const apIgnoresEvasion =
    apSkillFires?.effect.kind === "atk_multiplier" &&
    apSkillFires.effect.ignoresEvasion === true;

  // ── 방어자 dodge cascade ──────────────────────────────────────────────────
  // 1. 그림자 보법 — 페이즈 첫 공격(firstAttackPending) 시 한 번만 굴려, 발동하면 페이즈 통째 회피.
  // 2. 회피 강화 (evadesRemaining) — 잔량 > 0 이면 우선 1 소비, 이 공격 회피.
  // 3. % 회피 (evasionPct × precisionMult) — 표준 회피 굴림.
  // 4. 행운의 방패 (luckyShieldBlockPct) — 위 모두 실패 시 마지막 확률 굴림.
  // 어느 단계든 회피 시 dodge effects(곡예/무한 가시/반사 회피/반격/유격) 적용.

  // AP 스킬의 ignoresEvasion = true (천살 등) 면 회피 cascade 전체 스킵.
  if (!apIgnoresEvasion) {
    if (isFirstAttackOfTurn) {
      const shadowStepPct = defender.player.shadowStepPct ?? 0;
      if (shadowStepPct > 0 && Math.random() * 100 < shadowStepPct) {
        return applyShadowStepDodge(state, atkKey, defKey);
      }
    }
    if (defender.stacks.evadesRemaining > 0) {
      return applyPerAttackDodge(
        state,
        atkKey,
        defKey,
        `[회피 강화] ${defender.name}이(가) 공격을 회피했다.`,
        true,
      );
    }
    const precisionMult = attacker.player.precisionEvasionMult ?? 1;
    // 이중 행운 — 방어자 활성 시 회피 +bonus%. 만물 행운 / 회전 운기도 회피에 합산.
    const luckEvadeBonus = defender.flags.luckyBuffActive
      ? defender.player.doubleLuck?.evade ?? 0
      : 0;
    const universalLuckEvadeBonus = defender.player.universalLuckBonusPct ?? 0;
    const effectiveEvadePct =
      defender.player.evasionPct * precisionMult +
      luckEvadeBonus +
      universalLuckEvadeBonus +
      defender.buffs.cyclingChiBonus;
    if (effectiveEvadePct > 0 && Math.random() * 100 < effectiveEvadePct) {
      return applyPerAttackDodge(
        state,
        atkKey,
        defKey,
        `${defender.name}이(가) ${attacker.name}의 공격을 회피했다.`,
        false,
      );
    }
    const luckyShieldPct = defender.player.luckyShieldBlockPct ?? 0;
    if (luckyShieldPct > 0 && Math.random() * 100 < luckyShieldPct) {
      return applyPerAttackDodge(
        state,
        atkKey,
        defKey,
        `[행운의 방패] ${defender.name}이(가) 공격을 흘려보냈다.`,
        false,
      );
    }
  }

  // 암살 (특기) — 전투 첫 공격 시 1회, DEF 무시 + 데미지 배수.
  const assassinFires =
    (attacker.player.assassinateDmgMult ?? 0) > 1 &&
    !attacker.flags.assassinateUsed &&
    attacker.turn.completedPlayerTurns === 0 &&
    isFirstAttackOfTurn;
  // 약점 적중 — 큐가 있으면 이 공격은 DEF 무시.
  const weakpointDefIgnore = attacker.stacks.weakpointDefIgnoreLeft > 0;
  // 분쇄 — 강공격 발동 턴 그 공격에 한해 적 DEF -crushDefReduction.
  const crushReduction = attacker.player.crushDefReduction ?? 0;
  const baseDef = attackerFacingDef(attacker, defender);
  const targetDef =
    assassinFires || weakpointDefIgnore || apIgnoresDef
      ? 0
      : powerBonus > 0 && crushReduction > 0
        ? Math.max(0, baseDef - crushReduction)
        : baseDef;

  // 광전사 (특기) — 잃은 HP 비율만큼 ATK 가산.
  const lostHpFraction = Math.max(0, 1 - attacker.hp / attacker.maxHp);
  const berserkBonus =
    (attacker.player.berserkAtkPctPerLostHpPct ?? 0) > 0
      ? Math.floor(
          attacker.player.atk *
            lostHpFraction *
            attacker.player.berserkAtkPctPerLostHpPct!,
        )
      : 0;
  // 질풍검 — 턴 첫 공격에 (그 턴 공격 횟수 × N).
  const gustBonus =
    (attacker.player.gustAtkPerAttack ?? 0) > 0 && isFirstAttackOfTurn
      ? attacker.attacksLeft * attacker.player.gustAtkPerAttack!
      : 0;
  // 불굴의 일격 (2티어) — 턴 첫 공격에 (누적 받은 피해 × N).
  const enduringStrikeBonus =
    (attacker.player.enduringStrikeMult ?? 0) > 0 && isFirstAttackOfTurn
      ? Math.floor(
          attacker.stacks.damageTakenThisCombat *
            attacker.player.enduringStrikeMult!,
        )
      : 0;
  // 회전 운기 — 매 턴 시작 시 +cyclingChiPerTurn(%) 누적, 그 턴 즉시 적용.
  const cyclingChiThisTurn =
    attacker.buffs.cyclingChiBonus +
    (isFirstAttackOfTurn ? attacker.player.cyclingChiPerTurn ?? 0 : 0);
  // 크리티컬 — 기본 + 행운 + 천칭 + 만물 행운 + 회전 운기.
  const baseCritPct = attacker.player.critChancePct ?? 0;
  const luckCritBonus = attacker.flags.luckyBuffActive
    ? attacker.player.doubleLuck?.crit ?? 0
    : 0;
  const balanceCritBonus =
    (attacker.player.balanceCritPctPerSpdDiff ?? 0) > 0
      ? Math.floor(
          Math.max(0, attacker.player.spd - defender.player.spd) *
            attacker.player.balanceCritPctPerSpdDiff!,
        )
      : 0;
  const universalLuckBonus = attacker.player.universalLuckBonusPct ?? 0;
  const effectiveCritPct =
    baseCritPct +
    luckCritBonus +
    balanceCritBonus +
    universalLuckBonus +
    cyclingChiThisTurn;
  // 연쇄 운명 — 큐가 있으면 강제 크리. 큐는 이번 공격에 소비.
  const fatedChainConsumed = attacker.flags.fatedChainCritPending;
  const critRoll = fatedChainConsumed
    ? true
    : effectiveCritPct > 0
      ? Math.random() * 100 < effectiveCritPct
      : false;
  // 베이스 데미지 — ATK + rampage + powerBonus + berserk + gust + enduringStrike vs targetDef.
  // (rampage 는 effectiveAttackerAtk 의 일부 — 여기선 명시적으로 분해해서 본타 합산).
  const baseAtkValue =
    attacker.player.atk +
    attacker.buffs.rampageAtkBonus +
    powerBonus +
    berserkBonus +
    gustBonus +
    enduringStrikeBonus;
  // 약점 분석으로 인한 본인 ATK 페널티 (defender 가 적용한 페널티) 반영.
  const baseAtkWithAnalysis = Math.max(
    0,
    baseAtkValue - defender.buffs.opponentAtkPenalty,
  );
  // AP 스킬의 atk_multiplier 는 모든 ATK 합산 후 곱 (engine.ts:788-794 미러).
  const atkForDmg =
    apAtkMult !== 1
      ? Math.floor(baseAtkWithAnalysis * apAtkMult)
      : baseAtkWithAnalysis;
  const baseDmg = damageBetween(atkForDmg, targetDef);
  // 처형 — defender 의 HP 비율이 임계 미만이면 데미지 ×mult.
  const exMult = attacker.player.executionDamageMult ?? 1;
  const exFraction = attacker.player.executionHpFraction ?? 0;
  const executionActive =
    exMult > 1 && exFraction > 0 && defender.hp / defender.maxHp < exFraction;
  const dmgAfterExecution = executionActive
    ? Math.max(1, Math.floor(baseDmg * exMult))
    : baseDmg;
  const critMult = attacker.player.critMult ?? CRIT_MULT_BASE;
  const dmgAfterCrit = critRoll
    ? Math.floor(dmgAfterExecution * critMult)
    : dmgAfterExecution;
  // 행운의 별 (5티어).
  const luckyStarPct = attacker.player.luckyStarChancePct ?? 0;
  const luckyStarFires =
    luckyStarPct > 0 && Math.random() * 100 < luckyStarPct;
  const dmgAfterLuckyStar = luckyStarFires
    ? Math.floor(dmgAfterCrit * LUCKY_STAR_DAMAGE_MULT)
    : dmgAfterCrit;
  // 암살 — 모든 배수 후 ×N.
  const dmg = assassinFires
    ? Math.floor(dmgAfterLuckyStar * attacker.player.assassinateDmgMult!)
    : dmgAfterLuckyStar;
  // 천명 (4티어) — 확률로 적 현재 HP 의 N% 추가 고정 피해.
  const decreeFires =
    (attacker.player.heavenDecreeChancePct ?? 0) > 0 &&
    Math.random() * 100 < attacker.player.heavenDecreeChancePct!;
  const decreeDmg = decreeFires
    ? Math.floor((defender.hp * HEAVEN_DECREE_HP_PCT) / 100)
    : 0;
  // 충돌파 (6티어) — 매 IMPACT_WAVE_INTERVAL 턴마다 본타 첫 공격에 추가 고정 피해.
  const impactPct = attacker.player.impactWaveHpPct ?? 0;
  const impactFires =
    impactPct > 0 &&
    isFirstAttackOfTurn &&
    turnNumber % IMPACT_WAVE_INTERVAL === 0;
  const impactDmg = impactFires
    ? Math.floor((defender.hp * impactPct) / 100)
    : 0;
  const totalDmg = dmg + decreeDmg + impactDmg;
  const labels: string[] = [];
  if (powerBonus > 0) labels.push("강공격");
  if (powerBonus > 0 && crushReduction > 0) labels.push("분쇄");
  if (executionActive) labels.push("처형");
  if (critRoll) labels.push("크리티컬");
  if (luckyStarFires) labels.push("행운의 별");
  if (assassinFires) labels.push("암살");
  if (decreeFires) labels.push("천명");
  if (impactFires) labels.push("충돌파");
  if (enduringStrikeBonus > 0) labels.push("불굴의 일격");
  if (weakpointDefIgnore) labels.push("약점 적중");
  if (fatedChainConsumed) labels.push("연쇄 운명");
  if (apSkillFires) labels.push(apSkillFires.name);
  const prefix = labels.length > 0 ? `[${labels.join(" + ")}] ` : "";
  // ── 방어자 측 데미지 감산 (가드 → 굳건한 의지 → 철벽 → 불굴 → 흡혈 갑옷) ──
  const guard = defender.player.guard;
  const guarded =
    guard && guard.turns > 0 && defender.turn.enemyPhasesCompleted < guard.turns
      ? Math.max(0, totalDmg - guard.reduction)
      : totalDmg;
  const guardApplied = guarded < totalDmg;
  const steadfastFlat = defender.player.steadfastWillFlat ?? 0;
  const afterSteadfast =
    steadfastFlat > 0 ? Math.max(0, guarded - steadfastFlat) : guarded;
  const steadfastApplied = afterSteadfast < guarded;
  const shieldAbsorbed = Math.min(defender.stacks.playerShield, afterSteadfast);
  const dmgToHp = afterSteadfast - shieldAbsorbed;
  const newShield = defender.stacks.playerShield - shieldAbsorbed;
  // 불굴 — HP 0 직전 1 로 막아준다 (전투당 1회).
  const wouldKill = defender.hp - dmgToHp <= 0;
  const enduranceFires =
    wouldKill &&
    !!defender.player.enduranceActive &&
    !defender.flags.enduranceTriggered;
  const defenderHpAfterDmg = enduranceFires
    ? 1
    : Math.max(0, defender.hp - dmgToHp);
  // 흡혈 갑옷 — 받은 HP 피해의 N% HP 회복 (생존 시).
  const bloodfeastPct = defender.player.bloodfeastPct ?? 0;
  const bloodfeastHeal =
    bloodfeastPct > 0 && dmgToHp > 0 && defenderHpAfterDmg > 0
      ? Math.floor((dmgToHp * bloodfeastPct) / 100)
      : 0;
  const newDefenderHp =
    bloodfeastHeal > 0
      ? Math.min(defender.maxHp, defenderHpAfterDmg + bloodfeastHeal)
      : defenderHpAfterDmg;
  // ── 로그 — 가드 → 굳건한 의지 → 철벽 → 본타 → 불굴 → 흡혈 갑옷 → 이중 행운 → 흡혈 ──
  let log = state.log;
  if (guardApplied) {
    log = appendLog(log, {
      kind: "info",
      text: `[가드] ${defender.name} 피해 -${totalDmg - guarded}`,
    });
  }
  if (steadfastApplied) {
    log = appendLog(log, {
      kind: "info",
      text: `[굳건한 의지] ${defender.name} 피해 -${guarded - afterSteadfast}`,
    });
  }
  if (shieldAbsorbed > 0) {
    log = appendLog(log, {
      kind: "info",
      text: `[철벽] ${defender.name} 보호막이 ${shieldAbsorbed} 흡수 (남은 ${newShield})`,
    });
  }
  log = appendLog(log, {
    kind: "player_attack",
    text: `${prefix}${defender.name}에게 ${dmgToHp} 피해를 입혔다.`,
  });
  if (enduranceFires) {
    log = appendLog(log, {
      kind: "info",
      text: `[불굴] ${defender.name} 마지막 한 숨 — HP 1 로 버텼다!`,
    });
  }
  if (bloodfeastHeal > 0) {
    log = appendLog(log, {
      kind: "info",
      text: `[흡혈 갑옷] ${defender.name}의 HP +${bloodfeastHeal}`,
    });
  }
  // 이중 행운 — 첫 크리 발동 순간 활성화.
  const shouldActivateLucky =
    critRoll &&
    !attacker.flags.luckyBuffActive &&
    (attacker.player.doubleLuck?.crit ?? 0) > 0;
  if (shouldActivateLucky) {
    log = appendLog(log, {
      kind: "info",
      text: `[이중 행운] ${attacker.name} 회피/크리티컬 +${attacker.player.doubleLuck!.crit}% 발동!`,
    });
  }
  // 흡혈 / 행운의 흡혈 / 흡혈의 룬 — 가한 dmg (본타) 의 N% HP 회복.
  const lifestealHeal =
    critRoll && (attacker.player.lifestealCritHealPct ?? 0) > 0
      ? Math.floor((dmg * attacker.player.lifestealCritHealPct!) / 100)
      : 0;
  const luckyLifestealHeal =
    (attacker.player.luckyLifestealPct ?? 0) > 0
      ? Math.floor((dmg * attacker.player.luckyLifestealPct!) / 100)
      : 0;
  const runeLifestealHeal =
    (attacker.player.runeLifestealPct ?? 0) > 0
      ? Math.floor((dmg * attacker.player.runeLifestealPct!) / 100)
      : 0;
  const totalLifestealHeal =
    lifestealHeal + luckyLifestealHeal + runeLifestealHeal;
  const newAttackerHp =
    totalLifestealHeal > 0
      ? Math.min(attacker.maxHp, attacker.hp + totalLifestealHeal)
      : attacker.hp;
  const actualLifesteal = newAttackerHp - attacker.hp;
  if (actualLifesteal > 0) {
    const lsLabels: string[] = [];
    if (lifestealHeal > 0) lsLabels.push("흡혈");
    if (luckyLifestealHeal > 0) lsLabels.push("행운의 흡혈");
    if (runeLifestealHeal > 0) lsLabels.push("흡혈의 룬");
    log = appendLog(log, {
      kind: "info",
      text: `[${lsLabels.join(" + ")}] ${attacker.name}의 HP +${actualLifesteal}`,
    });
  }
  // 출혈 — 적중하면 attacker.stacks.bleedStacksOnOpponent +1 (이 사이드가 상대에게 누적).
  const newBleedOnOpponent =
    (attacker.player.bleedDmgPerStack ?? 0) > 0
      ? attacker.stacks.bleedStacksOnOpponent + 1
      : attacker.stacks.bleedStacksOnOpponent;
  // 약점 적중 — 크리 발동 시 그 턴 1회, DEF 무시 큐 추가 + 추가타.
  const weakpointFires =
    critRoll &&
    (attacker.player.weakpointExtraAttacks ?? 0) > 0 &&
    !attacker.turn.weakpointUsedThisTurn;
  const weakpointAdd = weakpointFires
    ? attacker.player.weakpointExtraAttacks!
    : 0;
  if (weakpointFires) {
    log = appendLog(log, {
      kind: "info",
      text: `[약점 적중] 빈틈을 — 한 번 더!`,
    });
  }
  // 연쇄 운명 — 크리 시 그 턴 1회, 다음 공격 크리 강제 큐.
  const fatedChainFires =
    critRoll &&
    !!attacker.player.fatedChainActive &&
    !attacker.turn.fatedChainTriggeredThisTurn;
  if (fatedChainFires) {
    log = appendLog(log, {
      kind: "info",
      text: `[연쇄 운명] ${attacker.name} — 별빛이 다음 결을 점지했다 (다음 공격 크리 보장).`,
    });
  }
  const newWeakpointLeft =
    Math.max(
      0,
      attacker.stacks.weakpointDefIgnoreLeft - (weakpointDefIgnore ? 1 : 0),
    ) + weakpointAdd;
  // ── AP 스킬 명중 시 부가 효과 (engine.ts:937-986 미러) ──────────────────────
  // 비-atk_multiplier 효과: heal_pct → 자가 회복, apply_bleed → 출혈 스택, add_guaranteed_evades → 보장 회피.
  // AP 회복 +1(행동 1회 명중) 한 후 cost 차감. 회복 먼저라 ult cost 와 정확히 일치할 때도 발동.
  const apHealAmount =
    apSkillFires?.effect.kind === "heal_pct"
      ? Math.floor((attacker.maxHp * apSkillFires.effect.pct) / 100)
      : 0;
  const apBleedAdd =
    apSkillFires?.effect.kind === "apply_bleed"
      ? apSkillFires.effect.stacks
      : 0;
  const apEvadesAdd =
    apSkillFires?.effect.kind === "add_guaranteed_evades"
      ? apSkillFires.effect.count
      : 0;
  const attackerHpAfterAPHeal =
    apHealAmount > 0
      ? Math.min(attacker.maxHp, newAttackerHp + apHealAmount)
      : newAttackerHp;
  const apHealActual = attackerHpAfterAPHeal - newAttackerHp;
  if (apHealActual > 0) {
    log = appendLog(log, {
      kind: "info",
      text: `[${apSkillFires!.name}] ${attacker.name}의 HP +${apHealActual}`,
    });
  }
  if (apBleedAdd > 0) {
    log = appendLog(log, {
      kind: "info",
      text: `[${apSkillFires!.name}] ${defender.name}에게 출혈 +${apBleedAdd}스택`,
    });
  }
  if (apEvadesAdd > 0) {
    log = appendLog(log, {
      kind: "info",
      text: `[${apSkillFires!.name}] 보장 회피 +${apEvadesAdd}`,
    });
  }
  const newApAfter = Math.max(
    0,
    Math.min(AP_CAP, attacker.ap + 1) - (apSkillFires?.apCost ?? 0),
  );
  // 사이드 갱신 — 공격자 + 방어자 (방어자엔 shield/endurance/damageTakenThisCombat 반영).
  const newAttacker: PvPSide = {
    ...attacker,
    hp: attackerHpAfterAPHeal,
    ap: newApAfter,
    flags: {
      ...attacker.flags,
      assassinateUsed: attacker.flags.assassinateUsed || assassinFires,
      luckyBuffActive: attacker.flags.luckyBuffActive || shouldActivateLucky,
      fatedChainCritPending: fatedChainFires
        ? true
        : fatedChainConsumed
          ? false
          : attacker.flags.fatedChainCritPending,
    },
    buffs: {
      ...attacker.buffs,
      cyclingChiBonus: cyclingChiThisTurn,
    },
    stacks: {
      ...attacker.stacks,
      bleedStacksOnOpponent: newBleedOnOpponent + apBleedAdd,
      evadesRemaining: attacker.stacks.evadesRemaining + apEvadesAdd,
      weakpointDefIgnoreLeft: newWeakpointLeft,
    },
    turn: {
      ...attacker.turn,
      critThisTurn: attacker.turn.critThisTurn || critRoll,
      fatedChainTriggeredThisTurn:
        attacker.turn.fatedChainTriggeredThisTurn || fatedChainFires,
      weakpointUsedThisTurn:
        attacker.turn.weakpointUsedThisTurn || weakpointFires,
      apSkillFiredThisTurn: apSkillFires
        ? apSkillFires.id
        : attacker.turn.apSkillFiredThisTurn,
    },
  };
  const newDefender: PvPSide = {
    ...defender,
    hp: newDefenderHp,
    flags: {
      ...defender.flags,
      enduranceTriggered: defender.flags.enduranceTriggered || enduranceFires,
    },
    stacks: {
      ...defender.stacks,
      playerShield: newShield,
      damageTakenThisCombat: defender.stacks.damageTakenThisCombat + dmgToHp,
    },
  };
  let next: PvPBattleState = setSide(
    setSide({ ...state, log }, atkKey, newAttacker),
    defKey,
    newDefender,
  );
  if (newDefenderHp <= 0) {
    return {
      ...next,
      log: appendLog(next.log, {
        kind: "info",
        text: `${defender.name}이(가) 쓰러졌다.`,
      }),
      phase: "ended",
      outcome: atkKey === "p1" ? "p1_win" : "p2_win",
    };
  }
  // ── on-hit reflect (반사 갑주 + 가시 갑옷 + 무한 가시) — 공격자에게 반사 피해 ──
  const reflectResult = applyOnHitReflect(next, atkKey, defKey, dmgToHp);
  next = reflectResult.state;
  if (reflectResult.attackerKilled) return next;
  // ── 반격의 룬 — 피격 후 일정 확률로 ATK 카운터 ──
  const runeCounterResult = maybeApplyRuneCounter(next, atkKey, defKey);
  next = runeCounterResult.state;
  if (runeCounterResult.attackerKilled) return next;
  // 남은 공격 횟수.
  const attacksLeft = attacker.attacksLeft - 1 + weakpointAdd;
  if (attacksLeft > 0) {
    return setSide(next, atkKey, {
      ...next[atkKey],
      attacksLeft,
      turn: { ...next[atkKey].turn, firstAttackPending: false },
    });
  }
  // 연타 — extraAttackEveryNTurns N 의 배수일 때.
  const interval = attacker.player.extraAttackEveryNTurns;
  const canDoubleStrike =
    !!interval &&
    interval > 0 &&
    turnNumber % interval === 0 &&
    !attacker.turn.doubleStrikeUsedThisTurn;
  if (canDoubleStrike) {
    next = {
      ...next,
      log: appendLog(next.log, { kind: "info", text: `[연타] ${attacker.name} 한 번 더!` }),
    };
    return setSide(next, atkKey, {
      ...next[atkKey],
      attacksLeft: 1,
      turn: {
        ...next[atkKey].turn,
        doubleStrikeUsedThisTurn: true,
        firstAttackPending: false,
      },
    });
  }
  // 광속.
  const lightspeedPct = attacker.player.lightspeedExtraAttackPct ?? 0;
  const canLightspeed =
    lightspeedPct > 0 &&
    !attacker.turn.lightspeedUsedThisTurn &&
    Math.random() * 100 < lightspeedPct;
  if (canLightspeed) {
    next = {
      ...next,
      log: appendLog(next.log, {
        kind: "info",
        text: `[광속] ${attacker.name} 잔상이 한 번 더!`,
      }),
    };
    return setSide(next, atkKey, {
      ...next[atkKey],
      attacksLeft: 1,
      turn: {
        ...next[atkKey].turn,
        lightspeedUsedThisTurn: true,
        firstAttackPending: false,
      },
    });
  }
  // 풍사슬 (5티어) — 추가 공격 후 확률로 1회 더. 캡 GALE_CHAIN_MAX_PER_TURN (6티어 무한 풍사슬 시 ETERNAL_GALE_ABSOLUTE_CAP).
  const baseGalePct = attacker.player.galeChainChancePct ?? 0;
  const eternalBonusPct = attacker.player.eternalGaleBonusPct ?? 0;
  const effectiveGalePct = baseGalePct + eternalBonusPct;
  const galeChainReady =
    attacker.turn.doubleStrikeUsedThisTurn ||
    attacker.turn.lightspeedUsedThisTurn ||
    attacker.turn.galeChainsThisTurn > 0;
  const galeCap = attacker.player.eternalGaleNoCap
    ? ETERNAL_GALE_ABSOLUTE_CAP
    : GALE_CHAIN_MAX_PER_TURN;
  const canGaleChain =
    effectiveGalePct > 0 &&
    galeChainReady &&
    attacker.turn.galeChainsThisTurn < galeCap &&
    Math.random() * 100 < effectiveGalePct;
  if (canGaleChain) {
    next = {
      ...next,
      log: appendLog(next.log, {
        kind: "info",
        text: `[풍사슬] ${attacker.name} 바람이 한 번 더!`,
      }),
    };
    return setSide(next, atkKey, {
      ...next[atkKey],
      attacksLeft: 1,
      turn: {
        ...next[atkKey].turn,
        galeChainsThisTurn: next[atkKey].turn.galeChainsThisTurn + 1,
        firstAttackPending: false,
      },
    });
  }
  // 연참 (특기) — 그 턴 크리 1회 이상이면 추가 공격 N회.
  const canRiposte =
    (attacker.player.riposteExtra ?? 0) > 0 &&
    !attacker.turn.riposteUsedThisTurn &&
    next[atkKey].turn.critThisTurn;
  if (canRiposte) {
    next = {
      ...next,
      log: appendLog(next.log, {
        kind: "info",
        text: `[연참] ${attacker.name} 빈틈을 — 한 번 더!`,
      }),
    };
    return setSide(next, atkKey, {
      ...next[atkKey],
      attacksLeft: attacker.player.riposteExtra!,
      turn: {
        ...next[atkKey].turn,
        riposteUsedThisTurn: true,
        firstAttackPending: false,
      },
    });
  }
  // 공격 턴 종료.
  return endAttackerPhase(next, atkKey, defKey);
}

// 공격자 페이즈 종료 → 후처리(분신/난무/막다른 격노/약점 분석/재생) → 출혈 도트 → 방어자 페이즈 시작.
// "방어자 페이즈 시작" 처리는 사실상 그냥 phase 를 상대 키로 토글 + 다음 공격자에게 attacksLeft 세팅.
// 출혈 도트는 "다음 공격자가 자기 페이즈 시작 시 도트 데미지를 입는" 시점이라 페이즈 전환 직후 처리.
function endAttackerPhase(
  state: PvPBattleState,
  atkKey: "p1" | "p2",
  defKey: "p1" | "p2",
): PvPBattleState {
  if (state.phase === "ended") return state;
  // 턴 카운터 갱신 — 공격자: completedPlayerTurns +1, 게이트 리셋.
  let next: PvPBattleState = setSide(state, atkKey, {
    ...state[atkKey],
    turn: {
      ...state[atkKey].turn,
      completedPlayerTurns: state[atkKey].turn.completedPlayerTurns + 1,
      doubleStrikeUsedThisTurn: false,
      lightspeedUsedThisTurn: false,
      critThisTurn: false,
      riposteUsedThisTurn: false,
      firstAttackPending: true,
      galeChainsThisTurn: 0,
      weakpointUsedThisTurn: false,
      fatedChainTriggeredThisTurn: false,
      apSkillFiredThisTurn: null,
    },
  });
  // 공격자 턴 후처리 (분신/난무/막다른 격노/약점 분석/재생).
  next = finishAttackerTurn(next, atkKey, defKey);
  if (next.phase === "ended") return next;
  // 방어자 페이즈 시작 — 출혈 도트(공격자가 누적한 stack × 공격자의 bleedDmgPerStack) 가 defender HP 에 적용.
  const attackerForBleed = next[atkKey];
  const defenderBefore = next[defKey];
  const bleedStacks = attackerForBleed.stacks.bleedStacksOnOpponent;
  const bleedDmgPer = attackerForBleed.player.bleedDmgPerStack ?? 0;
  if (bleedStacks > 0 && bleedDmgPer > 0) {
    const bleedDmg = bleedStacks * bleedDmgPer;
    const newHp = Math.max(0, defenderBefore.hp - bleedDmg);
    next = setSide(next, defKey, { ...defenderBefore, hp: newHp });
    next = {
      ...next,
      log: appendLog(next.log, {
        kind: "info",
        text: `[출혈] ${defenderBefore.name}이(가) 출혈로 ${bleedDmg} 피해 (스택 ${bleedStacks})`,
      }),
    };
    if (newHp <= 0) {
      return {
        ...next,
        log: appendLog(next.log, {
          kind: "info",
          text: `${defenderBefore.name}이(가) 쓰러졌다.`,
        }),
        phase: "ended",
        outcome: atkKey === "p1" ? "p1_win" : "p2_win",
      };
    }
  }
  // 방어자(다음 공격자) 의 enemyPhasesCompleted +1 — 이번 라운드에서 방어를 1회 마침 (가드 카운터에 사용).
  const defenderAfterBleed = next[defKey];
  next = setSide(next, defKey, {
    ...defenderAfterBleed,
    turn: {
      ...defenderAfterBleed.turn,
      enemyPhasesCompleted: defenderAfterBleed.turn.enemyPhasesCompleted + 1,
    },
  });
  // 새 방어자(다음 공격자) 의 attacksLeft 세팅. nextTurnAttackBonus(유격 누적) 소비.
  const newNextAttacker = next[defKey];
  next = setSide(next, defKey, {
    ...newNextAttacker,
    attacksLeft:
      rollAttackCount(newNextAttacker.player) +
      newNextAttacker.nextTurnAttackBonus,
    nextTurnAttackBonus: 0,
    turn: { ...newNextAttacker.turn, firstAttackPending: true },
  });
  // 페이즈 토글.
  return { ...next, phase: atkKey === "p1" ? "p2" : "p1" };
}

// 포션 효과 — 단일 사이드의 HP 회복. potionHealPct 자체 buffs 에서 가산.
function applyPotionTo(
  state: PvPBattleState,
  key: "p1" | "p2",
  potion: Potion,
): PvPBattleState {
  if (potion.effect.kind !== "heal_hp") return state;
  const side = state[key];
  const baseHeal = computeHealAmount(potion, side.maxHp);
  const heal = Math.floor(
    baseHeal * (1 + (side.buffs.potionHealPct ?? 0) / 100),
  );
  const newHp = Math.min(side.maxHp, side.hp + heal);
  const actual = newHp - side.hp;
  let next = setSide(state, key, { ...side, hp: newHp });
  next = {
    ...next,
    log: appendLog(next.log, {
      kind: "info",
      text: `${side.name}이(가) ${potion.name}을(를) 마셨다 — HP +${actual} (${side.hp} → ${newHp})`,
    }),
  };
  return next;
}

// 방어자 측 능력 통합은 PR-1b 에서. (파일 상단 시리즈 노트 참조.)

// ── 결판 (full simulation) ─────────────────────────────────────────────────

export type PvPResolveContext = {
  pickAction: (state: PvPBattleState, who: "p1" | "p2") => PlayerAction;
  potions: { p1: Partial<Record<PotionId, number>>; p2: Partial<Record<PotionId, number>> };
};

export type PvPBattleResolution = {
  outcome: PvPOutcome;
  finalState: PvPBattleState;
  potionsConsumed: {
    p1: Partial<Record<PotionId, number>>;
    p2: Partial<Record<PotionId, number>>;
  };
  turns: number;
};

// PvP 결판 — 양쪽이 turn cap 까지 결판 못 내면 무승부.
export const PVP_TURN_CAP = 100;

export function resolveBattlePvP(
  p1Player: PlayerCombat,
  p2Player: PlayerCombat,
  p1Name: string,
  p2Name: string,
  ctx: PvPResolveContext,
): PvPBattleResolution {
  const potions = {
    p1: { ...ctx.potions.p1 },
    p2: { ...ctx.potions.p2 },
  };
  const consumed = {
    p1: {} as Partial<Record<PotionId, number>>,
    p2: {} as Partial<Record<PotionId, number>>,
  };
  let state = initialBattleStatePvP(p1Player, p2Player, p1Name, p2Name);
  let turns = 0;
  while (state.phase !== "ended") {
    const who: "p1" | "p2" = state.phase === "p1" ? "p1" : "p2";
    let action: PlayerAction = { kind: "attack" };
    const picked = ctx.pickAction(state, who);
    if (picked.kind === "use_potion") {
      const have = potions[who][picked.potionId] ?? 0;
      if (have > 0) {
        potions[who][picked.potionId] = have - 1;
        consumed[who][picked.potionId] = (consumed[who][picked.potionId] ?? 0) + 1;
        action = picked;
      }
    } else {
      action = picked;
    }
    state = advanceTurnPvP(state, action);
    turns += 1;
    // PvP 무한 루프 가드 / 시간 캡. 양쪽 다 데미지 0 이면 hp% 로 승부 결정 (높은 쪽 승, 동률 무승부).
    if (turns > PVP_TURN_CAP && state.phase !== "ended") {
      const p1Frac = state.p1.hp / state.p1.maxHp;
      const p2Frac = state.p2.hp / state.p2.maxHp;
      const outcome: PvPOutcome =
        p1Frac > p2Frac ? "p1_win" : p2Frac > p1Frac ? "p2_win" : "draw";
      return {
        outcome,
        finalState: { ...state, phase: "ended", outcome },
        potionsConsumed: consumed,
        turns,
      };
    }
    // 안전 가드 — 더 큰 절대 캡.
    if (turns > 1000) {
      return {
        outcome: "draw",
        finalState: { ...state, phase: "ended", outcome: "draw" },
        potionsConsumed: consumed,
        turns,
      };
    }
  }
  return {
    outcome: state.outcome ?? "draw",
    finalState: state,
    potionsConsumed: consumed,
    turns,
  };
}
