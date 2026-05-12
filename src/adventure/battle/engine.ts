import type { Monster } from "../data/monsters";
import { computeHealAmount, type Potion, type PotionId } from "../data/potions";
import {
  CRIT_MULT_BASE,
  HEAVEN_DECREE_HP_PCT,
  POWER_ATTACK_TURN_INTERVAL,
} from "../character/skills";

export type BattleLogEntry = {
  kind: "player_attack" | "enemy_attack" | "info" | "phase_trigger";
  text: string;
};

export type BattleOutcome = "win" | "lose";

export type BattlePhase = "player" | "enemy" | "ended";

export type BattleState = {
  enemy: Monster;
  enemyHp: number;
  playerHp: number;
  playerMaxHp: number;
  log: BattleLogEntry[];
  phase: BattlePhase;
  outcome: BattleOutcome | null;
  playerAttacksLeft: number;
  // 완료된 플레이어 턴 수 — 강공격(N턴마다 발동) 트리거에 사용. 진행 중인 턴은 미포함.
  completedPlayerTurns: number;
  // 종료된 적 페이즈 수 — 가드("첫 N턴" 의미) 가 선공자에 무관하게 N번 발동하도록
  // 적 페이즈 시작 직전에 비교하고 페이즈 종료 시 +1.
  enemyPhasesCompleted: number;
  // 회피 강화로 적립된 보장 회피 잔량 — enemy phase 에서 % 회피 판정 전에 우선 소모.
  evadesRemaining: number;
  // 연타가 한 턴에 한 번만 발동하도록 막는 게이트 — 새 턴 시작 시 false 로 리셋.
  doubleStrikeUsedThisTurn: boolean;
  // 이중 행운 — 첫 크리티컬 발동 시 true 로 전환, 전투 종료까지 유지. 회피/크리티컬 보너스 적용 게이트.
  luckyBuffActive: boolean;
  // 그 턴의 첫 공격이 아직 안 나갔는지 — 강공격(첫 공격에만 보너스) 트리거에 사용.
  // 새 턴 시작 시 true, 첫 공격 후 false. 연타(같은 턴 연장)에는 영향 없음.
  firstAttackPending: boolean;
  // 적 페이즈 트리거로 누적된 DEF 보너스. 기본 0, 트리거 발동 시 enemy.phaseTrigger.defBonus 만큼 증가.
  enemyDefBonus: number;
  // 페이즈 트리거 1회성 가드. 트리거 발동 후 true 로 전환되어 같은 전투에서 중복 발동 방지.
  phaseTriggered: boolean;
  // 잡몹 스킬 "격노"로 누적된 적 ATK 보너스. 기본 0, 발동 시 enemy.skill.atkBonus 만큼 증가.
  enemyAtkBonus: number;
  // "격노" 1회성 가드 — 발동 후 true 로 전환되어 같은 전투에서 중복 발동 방지.
  enrageTriggered: boolean;
  // 광속이 한 턴에 한 번만 발동하도록 막는 게이트 — 새 턴 시작 시 false 로 리셋. 연타와 별개.
  lightspeedUsedThisTurn: boolean;
  // 불굴 1회성 가드. 발동 후 true — 같은 전투에서 두 번째 치명 피해에는 정상 사망.
  enduranceTriggered: boolean;
  // 출혈 (4티어) — 누적 스택. 매 적 턴 시작 시 스택당 bleedDmgPerStack 만큼 적 HP 감소 (DEF 무시).
  bleedStacks: number;
  // 철벽 (4티어) — 남은 보호막. 받는 피해를 먼저 흡수. 회복 안 됨.
  playerShield: number;
  // 무피해 난무 (4티어) — 이 전투에서 플레이어가 실제로 받은 누적 HP 피해 (보호막 흡수분 제외). 0 = 무피해.
  damageTakenThisCombat: number;
  // 암살 (특기) — 전투 첫 공격에 1회 발동 후 true. 같은 전투에서 재발동 안 함.
  assassinateUsed: boolean;
  // 연참 (특기) — 이번 턴에 크리티컬이 한 번이라도 났는지. 턴 종료 시 false 로 리셋.
  critThisTurn: boolean;
  // 연참 (특기) — 이번 턴에 연참 추가타가 이미 발동했는지 (턴당 1회). 턴 종료 시 false 로 리셋.
  riposteUsedThisTurn: boolean;
};

export type PlayerCombat = {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number; // 선공 판정에 사용
  evasionPct: number; // 0~100, 적 공격 회피 확률
  attackCount: number; // 한 턴에 가하는 공격 횟수 (>=1)
  // 매 턴 시작 시 이 확률(0~100)로 추가 공격 1회. SPD 의 기본 환산.
  extraAttackChancePct?: number;
  // 강공격 보너스 — POWER_ATTACK_TURN_INTERVAL 턴마다 첫 공격에 추가 피해. 0/undefined = 스킬 미보유.
  powerAttackBonus?: number;
  // 분쇄 — 강공격 발동 턴, 그 공격에 한해 적 DEF 감산. 0/undefined = 스킬 미보유.
  crushDefReduction?: number;
  // 회피 강화 — 전투 시작 시 적립할 보장 회피 횟수. 0/undefined = 스킬 미보유.
  guaranteedEvades?: number;
  // 반격 — 회피 성공 시 즉시 카운터 1회, ATK + bonus 데미지. 0/undefined = 스킬 미보유.
  counterAtkBonus?: number;
  // 연타 — N턴마다 그 턴 마지막 공격 후 추가 1회 공격. undefined = 스킬 미보유.
  extraAttackEveryNTurns?: number;
  // 기습 — 전투 첫 플레이어 턴 추가 공격. 0/undefined = 스킬 미보유.
  vanguardFirstTurnBonus?: number;
  // 크리티컬 — 매 공격마다 발동 확률(0~100). 0/undefined = 스킬 미보유.
  critChancePct?: number;
  // 크리티컬 데미지 배수. undefined = CRIT_MULT_BASE 사용. luk 비례로 호출 측이 계산.
  critMult?: number;
  // 이중 행운 — 첫 크리티컬 발동 시 회피/크리티컬 +bonus% 발동, 전투 종료까지 유지. 0 이면 미보유.
  doubleLuck?: { evade: number; crit: number };
  // 가드 — 첫 N턴 동안 받는 피해 -reduction. 둘 다 0 이면 스킬 미보유.
  guard?: { turns: number; reduction: number };
  // 재생 — interval 턴마다 HP +amount. 둘 다 0 이면 스킬 미보유.
  regen?: { interval: number; amount: number };
  // 처형 — 적 HP 비율이 hpFraction 미만일 때 데미지 ×mult. mult <= 1 또는 hpFraction <= 0 = 미보유.
  executionDamageMult?: number;
  executionHpFraction?: number;
  // 정확 — 적 evasionPct 에 곱할 배수 (0~1). undefined/1 = 미보유 (정상 회피).
  precisionEvasionMult?: number;
  // 불굴 — true 면 전투당 1회 HP 0 데미지를 HP 1 로 막아준다.
  enduranceActive?: boolean;
  // 광속 — 매 턴 마지막 공격 후 추가 1회 공격 확률(%). 0/undefined = 미보유.
  lightspeedExtraAttackPct?: number;
  // ── 특기 (특기 전용 슬롯, 1개만) ──────────────────────────────────────
  // 흡혈 — 크리티컬로 준 피해의 N% 만큼 HP 회복. 0/undefined = 미장착.
  lifestealCritHealPct?: number;
  // 곡예 — 회피(보장/%/행운의 방패) 성공 시 HP +amount. 0/undefined = 미장착.
  evadeHealAmount?: number;
  // 천칭 — (내SPD − 적SPD) 1당 추가 크리티컬 확률(%). 0/undefined = 미장착.
  balanceCritPctPerSpdDiff?: number;
  // 행운의 방패 — 피격을 무효화할 확률(%). 0/undefined = 미장착.
  luckyShieldBlockPct?: number;
  // ── 4티어 ──────────────────────────────────────────────────────────────
  // 출혈 — 적중 시 출혈 1스택, 매 적 턴마다 스택당 이만큼 고정 피해(DEF 무시). 0/undefined = 미보유.
  bleedDmgPerStack?: number;
  // 그림자 분신 — 매 플레이어 턴 종료 시 분신이 ATK 의 N% 로 추가 공격 1회. 0/undefined = 미보유.
  shadowCloneAtkPct?: number;
  // 철벽 — 전투 시작 시 받는 보호막. 0/undefined = 미보유.
  bulwarkShield?: number;
  // 무피해 난무 — 무피해 턴 종료 시 추가 공격 횟수. 0/undefined = 미보유.
  flurryAttacks?: number;
  // 천명 — 매 공격마다 적 현재 HP 의 HEAVEN_DECREE_HP_PCT% 를 추가 고정 피해로 줄 확률(%). 0/undefined = 미보유.
  heavenDecreeChancePct?: number;
  // ── 특기 (Phase 3) ─────────────────────────────────────────────────────
  // 광전사 — 잃은 HP 1%당 ATK +N%. 0/undefined = 미장착.
  berserkAtkPctPerLostHpPct?: number;
  // 암살 — 전투 첫 공격의 데미지 배수 (DEF 무시 동반). >1 일 때만 발동. 0/undefined = 미장착.
  assassinateDmgMult?: number;
  // 질풍검 — 턴 첫 공격에 (공격 횟수 × N) ATK 보너스. 0/undefined = 미장착.
  gustAtkPerAttack?: number;
  // 연참 — 그 턴 크리 발동 시 추가 공격 N회 (턴당 1회). 0/undefined = 미장착.
  riposteExtra?: number;
  // 유격 — 회피 성공 시 다음 플레이어 턴 공격 횟수 +N. 0/undefined = 미장착.
  skirmishNextTurnBonus?: number;
  // 반사 갑주 — 피격 시 받은 HP 피해의 N% 를 적에게 반사. 0/undefined = 미장착.
  thornsPct?: number;
};

export type PlayerAction =
  | { kind: "attack" }
  | { kind: "use_potion"; potionId: PotionId; potion: Potion };

// 로그는 전체 보관 — 종료 후 알림에 첨부되는 battleLog 도 같은 배열을 사용한다.
// BattleScene 은 스크롤 컨테이너라 길이가 늘어도 UX 영향 없음.
export function appendLog(
  log: BattleLogEntry[],
  entry: BattleLogEntry,
): BattleLogEntry[] {
  return [...log, entry];
}

export function damageBetween(atk: number, def: number): number {
  return Math.max(1, atk - def);
}

// 다음 플레이어 턴의 공격 횟수 — 기본 attackCount + extraAttackChancePct 1회 판정.
function rollPlayerAttackCount(player: PlayerCombat): number {
  const base = Math.max(1, player.attackCount);
  const chance = player.extraAttackChancePct ?? 0;
  if (chance > 0 && Math.random() * 100 < chance) return base + 1;
  return base;
}

// 페이즈 트리거 — 적 HP 가 phaseTrigger.hpFraction 미만으로 떨어진 순간 1회 발동.
// enemyDefBonus 누적 + 알림 로그. 이미 죽었거나 발동했으면 무시. 호출 측은 enemyHp 가
// 갱신된 state 를 넘겨야 한다.
function applyPhaseTriggerIfAny(state: BattleState): BattleState {
  const trigger = state.enemy.phaseTrigger;
  if (!trigger || state.phaseTriggered) return state;
  if (state.enemyHp <= 0) return state;
  const threshold = state.enemy.hp * trigger.hpFraction;
  if (state.enemyHp >= threshold) return state;
  return {
    ...state,
    phaseTriggered: true,
    enemyDefBonus: state.enemyDefBonus + trigger.defBonus,
    log: appendLog(state.log, { kind: "phase_trigger", text: trigger.message }),
  };
}

// 반격 — 회피 직후 카운터 1회. 적이 죽으면 ended 로 종료.
// 크리티컬 / 강공격 등은 적용하지 않음 — 별도 단순 데미지.
function applyCounterIfAny(
  state: BattleState,
  player: PlayerCombat,
): { state: BattleState; ended: boolean } {
  const bonus = player.counterAtkBonus ?? 0;
  if (bonus <= 0) return { state, ended: false };
  const dmg = damageBetween(
    player.atk + bonus,
    state.enemy.def + state.enemyDefBonus,
  );
  const enemyHp = Math.max(0, state.enemyHp - dmg);
  let next: BattleState = {
    ...state,
    enemyHp,
    log: appendLog(state.log, {
      kind: "player_attack",
      text: `[반격] ${state.enemy.name}에게 ${dmg} 피해를 입혔다.`,
    }),
  };
  next = applyPhaseTriggerIfAny(next);
  if (enemyHp <= 0) {
    return {
      state: {
        ...next,
        log: appendLog(next.log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
      },
      ended: true,
    };
  }
  return { state: next, ended: false };
}

// 재생 — 플레이어 턴 종료 후 (completedPlayerTurns 증가 후) 호출.
// completedPlayerTurns 가 interval 의 배수일 때 HP +amount.
function applyRegenIfAny(
  state: BattleState,
  player: PlayerCombat,
  playerName: string,
): BattleState {
  const regen = player.regen;
  if (!regen || regen.interval <= 0 || regen.amount <= 0) return state;
  if (state.completedPlayerTurns === 0) return state;
  if (state.completedPlayerTurns % regen.interval !== 0) return state;
  if (state.playerHp >= state.playerMaxHp) return state;
  const newHp = Math.min(state.playerMaxHp, state.playerHp + regen.amount);
  const actual = newHp - state.playerHp;
  return {
    ...state,
    playerHp: newHp,
    log: appendLog(state.log, {
      kind: "info",
      text: `[재생] ${playerName}의 HP +${actual}`,
    }),
  };
}

// 부가 공격(분신/난무 등) 1회 — 데미지 적용 + 페이즈 트리거 + 사망 처리. 크리/강공격/브레이스 등 미적용 (반격과 동일하게 단순 데미지).
function dealExtraEnemyDamage(
  state: BattleState,
  dmg: number,
  label: string,
): BattleState {
  const enemyHp = Math.max(0, state.enemyHp - dmg);
  let next = applyPhaseTriggerIfAny({
    ...state,
    enemyHp,
    log: appendLog(state.log, {
      kind: "player_attack",
      text: `[${label}] ${state.enemy.name}에게 ${dmg} 피해를 입혔다.`,
    }),
  });
  if (enemyHp <= 0) {
    next = {
      ...next,
      log: appendLog(next.log, {
        kind: "info",
        text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
      }),
      phase: "ended",
      outcome: "win",
    };
  }
  return next;
}

// 플레이어 턴 종료 후 처리 — 그림자 분신 추가타 → 무피해 난무 추가타들 → 재생.
// 추가타로 적이 죽으면 즉시 종료(이후 단계 건너뜀). 종전 applyRegenIfAny 호출을 이 함수로 대체.
function finishPlayerTurn(
  state: BattleState,
  player: PlayerCombat,
  playerName: string,
): BattleState {
  let st = state;
  // 그림자 분신 — ATK 의 N% 로 1회.
  const clonePct = player.shadowCloneAtkPct ?? 0;
  if (st.phase !== "ended" && clonePct > 0) {
    const cloneDmg = damageBetween(
      Math.floor((player.atk * clonePct) / 100),
      st.enemy.def + st.enemyDefBonus,
    );
    st = dealExtraEnemyDamage(st, cloneDmg, "그림자 분신");
  }
  // 무피해 난무 — 이 전투에서 받은 피해가 0이면 추가 공격 N회.
  const flurry = player.flurryAttacks ?? 0;
  if (st.phase !== "ended" && flurry > 0 && st.damageTakenThisCombat === 0) {
    for (let i = 0; i < flurry; i += 1) {
      if (st.phase === "ended") break;
      const fd = damageBetween(player.atk, st.enemy.def + st.enemyDefBonus);
      st = dealExtraEnemyDamage(st, fd, "무피해 난무");
    }
  }
  if (st.phase === "ended") return st;
  return applyRegenIfAny(st, player, playerName);
}

// 선공 — SPD가 높은 쪽이 먼저 공격. 동점이면 플레이어 우선.
export function initialBattleState(
  player: PlayerCombat,
  enemy: Monster,
  playerName: string,
): BattleState {
  const playerFirst = player.spd >= enemy.spd;
  const initiator = playerFirst ? playerName : enemy.name;
  const vanguardBonus = player.vanguardFirstTurnBonus ?? 0;
  const log: BattleLogEntry[] = [
    {
      kind: "info",
      text: `${enemy.name}이(가) 나타났다!`,
    },
    {
      kind: "info",
      text: `${initiator}의 선공.`,
    },
  ];
  if (vanguardBonus > 0) {
    log.push({
      kind: "info",
      text: `[기습] 첫 턴 추가 공격 ${vanguardBonus}회!`,
    });
  }
  if (enemy.skill) {
    log.push({
      kind: "info",
      text: `${enemy.name} — 능력 [${enemy.skill.name}]`,
    });
  }
  const startShield = player.bulwarkShield ?? 0;
  if (startShield > 0) {
    log.push({ kind: "info", text: `[철벽] 보호막 ${startShield} 전개` });
  }
  return {
    enemy,
    enemyHp: enemy.hp,
    playerHp: player.hp,
    playerMaxHp: player.maxHp,
    log,
    phase: playerFirst ? "player" : "enemy",
    outcome: null,
    playerAttacksLeft: rollPlayerAttackCount(player) + vanguardBonus,
    completedPlayerTurns: 0,
    enemyPhasesCompleted: 0,
    evadesRemaining: player.guaranteedEvades ?? 0,
    doubleStrikeUsedThisTurn: false,
    luckyBuffActive: false,
    firstAttackPending: true,
    enemyDefBonus: 0,
    phaseTriggered: false,
    enemyAtkBonus: 0,
    enrageTriggered: false,
    lightspeedUsedThisTurn: false,
    enduranceTriggered: false,
    bleedStacks: 0,
    playerShield: startShield,
    damageTakenThisCombat: 0,
    assassinateUsed: false,
    critThisTurn: false,
    riposteUsedThisTurn: false,
  };
}

// 한 턴 진행 — 현재 phase 측이 행동하고 결과를 다음 BattleState로 반환.
// player phase는 action(공격 또는 물약)으로 분기. attack이면 attackCount 만큼 연속 공격.
// phase === "ended" 이면 그대로 반환.
export function advanceTurn(
  state: BattleState,
  player: PlayerCombat,
  playerName: string,
  action: PlayerAction = { kind: "attack" },
): BattleState {
  if (state.phase === "ended") return state;

  if (state.phase === "player") {
    if (action.kind === "use_potion") {
      const next = applyPotionEffect(state, action.potion, playerName);
      return {
        ...next,
        phase: "enemy",
        playerAttacksLeft: rollPlayerAttackCount(player),
        firstAttackPending: true,
      };
    }

    // 강공격 발동 — POWER_ATTACK_TURN_INTERVAL 턴마다 그 턴의 첫 공격이 ATK + bonus.
    // 진행 중인 턴 번호 = completedPlayerTurns + 1. 첫 공격 여부는 firstAttackPending 으로 판단
    // (확률 기반 추가 공격 / 기습 보너스로 attackCount 비교가 신뢰할 수 없음).
    const turnNumber = state.completedPlayerTurns + 1;
    const isFirstAttackOfTurn = state.firstAttackPending;
    const bonus =
      isFirstAttackOfTurn &&
      turnNumber % POWER_ATTACK_TURN_INTERVAL === 0 &&
      (player.powerAttackBonus ?? 0) > 0
        ? player.powerAttackBonus!
        : 0;

    // 적 회피 — 데미지 굴리기 전에 1차 판정. 회피하면 공격 1회가 그대로 빗나간다.
    // 정확 슬롯 시 적 evasion 에 배수(<1) 가 곱해져 부분 무력화.
    const precisionMult = player.precisionEvasionMult ?? 1;
    const enemyEvasionPct = (state.enemy.evasionPct ?? 0) * precisionMult;
    if (enemyEvasionPct > 0 && Math.random() * 100 < enemyEvasionPct) {
      const log = appendLog(state.log, {
        kind: "player_attack",
        text: `${state.enemy.name}이(가) 공격을 피했다.`,
      });
      const attacksLeft = state.playerAttacksLeft - 1;
      if (attacksLeft > 0) {
        return {
          ...state,
          log,
          playerAttacksLeft: attacksLeft,
          firstAttackPending: false,
        };
      }
      const ended: BattleState = {
        ...state,
        log,
        phase: "enemy",
        playerAttacksLeft: rollPlayerAttackCount(player),
        completedPlayerTurns: state.completedPlayerTurns + 1,
        doubleStrikeUsedThisTurn: false,
        lightspeedUsedThisTurn: false,
        critThisTurn: false,
        riposteUsedThisTurn: false,
        firstAttackPending: true,
      };
      return finishPlayerTurn(ended, player, playerName);
    }

    // 암살 (특기) — 전투 첫 공격이면 발동: 적 DEF 무시 + 데미지 배수 (배수는 아래에서 적용).
    const assassinFires =
      (player.assassinateDmgMult ?? 0) > 1 &&
      !state.assassinateUsed &&
      state.completedPlayerTurns === 0 &&
      isFirstAttackOfTurn;
    // 분쇄 — 강공격 발동 턴, 그 공격에 한해 적 DEF -crushDefReduction. 암살이면 DEF 0.
    const crushReduction = player.crushDefReduction ?? 0;
    const baseDef = state.enemy.def + state.enemyDefBonus;
    const targetDef = assassinFires
      ? 0
      : bonus > 0 && crushReduction > 0
        ? Math.max(0, baseDef - crushReduction)
        : baseDef;
    // 광전사 (특기) — 잃은 HP 비율만큼 ATK 가산.
    // berserkAtkPctPerLostHpPct=0.5 → 잃은 HP 1%당 ATK +0.5% → 보너스ATK = atk × lostFraction × 0.5.
    const lostHpFraction = Math.max(0, 1 - state.playerHp / state.playerMaxHp);
    const berserkBonus =
      (player.berserkAtkPctPerLostHpPct ?? 0) > 0
        ? Math.floor(
            player.atk * lostHpFraction * player.berserkAtkPctPerLostHpPct!,
          )
        : 0;
    // 질풍검 (특기) — 턴 첫 공격에 (그 턴 공격 횟수 × N) ATK 보너스.
    const gustBonus =
      (player.gustAtkPerAttack ?? 0) > 0 && isFirstAttackOfTurn
        ? state.playerAttacksLeft * player.gustAtkPerAttack!
        : 0;
    // 크리티컬 — 매 공격마다 critChancePct 확률로 발동. 이중 행운 발동 후엔 +crit 보너스.
    const baseCritPct = player.critChancePct ?? 0;
    const luckCritBonus = state.luckyBuffActive
      ? player.doubleLuck?.crit ?? 0
      : 0;
    // 천칭 — 내 SPD 가 적보다 빠른 만큼 크리티컬 확률 가산.
    const balanceCritBonus =
      (player.balanceCritPctPerSpdDiff ?? 0) > 0
        ? Math.floor(
            Math.max(0, player.spd - state.enemy.spd) *
              player.balanceCritPctPerSpdDiff!,
          )
        : 0;
    const effectiveCritPct = baseCritPct + luckCritBonus + balanceCritBonus;
    const critRoll =
      effectiveCritPct > 0 ? Math.random() * 100 < effectiveCritPct : false;
    const baseDmg = damageBetween(
      player.atk + bonus + berserkBonus + gustBonus,
      targetDef,
    );
    // 처형 — 적 HP 비율 < executionHpFraction 일 때 데미지 ×executionDamageMult.
    // 강공격/분쇄 후 데미지에 곱하고, 크리티컬은 그 위에 다시 곱한다 (다단 누적).
    const exMult = player.executionDamageMult ?? 1;
    const exFraction = player.executionHpFraction ?? 0;
    const enemyMaxHp = state.enemy.hp;
    const executionActive =
      exMult > 1 && exFraction > 0 && state.enemyHp / enemyMaxHp < exFraction;
    const dmgAfterExecution = executionActive
      ? Math.max(1, Math.floor(baseDmg * exMult))
      : baseDmg;
    const critMult = player.critMult ?? CRIT_MULT_BASE;
    const dmgAfterCrit = critRoll
      ? Math.floor(dmgAfterExecution * critMult)
      : dmgAfterExecution;
    // 암살 (특기) — 위 모든 배수(처형/크리) 후에 다시 ×N.
    const dmgBeforeBrace = assassinFires
      ? Math.floor(dmgAfterCrit * player.assassinateDmgMult!)
      : dmgAfterCrit;
    // 잡몹 스킬 "방어 태세" — 이 적을 공격할 때 데미지 -damageReduction (최소 1로 클램프).
    const braceReduction =
      state.enemy.skill?.kind === "brace" ? state.enemy.skill.damageReduction : 0;
    const dmg =
      braceReduction > 0 ? Math.max(1, dmgBeforeBrace - braceReduction) : dmgBeforeBrace;
    // 천명 (4티어) — 일정 확률로 적 현재 HP 의 일부를 추가 고정 피해 (이 공격의 보통 피해와 별개로 합산).
    const decreeFires =
      (player.heavenDecreeChancePct ?? 0) > 0 &&
      Math.random() * 100 < player.heavenDecreeChancePct!;
    const decreeDmg = decreeFires
      ? Math.floor((state.enemyHp * HEAVEN_DECREE_HP_PCT) / 100)
      : 0;
    const totalDmg = dmg + decreeDmg;
    const labels: string[] = [];
    if (bonus > 0) labels.push("강공격");
    if (bonus > 0 && crushReduction > 0) labels.push("분쇄");
    if (executionActive) labels.push("처형");
    if (critRoll) labels.push("크리티컬");
    if (assassinFires) labels.push("암살");
    if (decreeFires) labels.push("천명");
    const prefix = labels.length > 0 ? `[${labels.join(" + ")}] ` : "";
    let log = appendLog(state.log, {
      kind: "player_attack",
      text: `${prefix}${state.enemy.name}에게 ${totalDmg} 피해를 입혔다.`,
    });
    // 이중 행운 — 첫 크리티컬 발동 순간 활성화, 후속 공격/회피 부터 보너스 적용.
    const shouldActivateLucky =
      critRoll &&
      !state.luckyBuffActive &&
      (player.doubleLuck?.crit ?? 0) > 0;
    if (shouldActivateLucky) {
      log = appendLog(log, {
        kind: "info",
        text: `[이중 행운] 회피/크리티컬 +${player.doubleLuck!.crit}% 발동!`,
      });
    }
    const luckyBuffActive = state.luckyBuffActive || shouldActivateLucky;
    // 흡혈 (특기) — 크리티컬로 준 피해의 % 만큼 HP 회복.
    const lifestealHeal =
      critRoll && (player.lifestealCritHealPct ?? 0) > 0
        ? Math.floor((dmg * player.lifestealCritHealPct!) / 100)
        : 0;
    const newPlayerHp =
      lifestealHeal > 0
        ? Math.min(state.playerMaxHp, state.playerHp + lifestealHeal)
        : state.playerHp;
    const actualLifesteal = newPlayerHp - state.playerHp;
    if (actualLifesteal > 0) {
      log = appendLog(log, {
        kind: "info",
        text: `[흡혈] ${playerName}의 HP +${actualLifesteal}`,
      });
    }
    const enemyHp = Math.max(0, state.enemyHp - totalDmg);
    // 출혈 (4티어) — 적중하면 출혈 1스택 누적 (다음 적 턴부터 도트).
    const bleedStacks =
      (player.bleedDmgPerStack ?? 0) > 0
        ? state.bleedStacks + 1
        : state.bleedStacks;
    // 페이즈 트리거 검사 — 데미지 적용 직후, 사망 분기 전에 처리해야 트리거된 def 가
    // 같은 턴 후속 공격(다중공격/연타)에 즉시 반영된다.
    const afterDamage = applyPhaseTriggerIfAny({
      ...state,
      enemyHp,
      playerHp: newPlayerHp,
      bleedStacks,
      assassinateUsed: state.assassinateUsed || assassinFires,
      critThisTurn: state.critThisTurn || critRoll,
      log,
      luckyBuffActive,
    });
    if (enemyHp <= 0) {
      return {
        ...afterDamage,
        log: appendLog(afterDamage.log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
        completedPlayerTurns: state.completedPlayerTurns + 1,
      };
    }
    const attacksLeft = state.playerAttacksLeft - 1;
    if (attacksLeft > 0) {
      return {
        ...afterDamage,
        playerAttacksLeft: attacksLeft,
        firstAttackPending: false,
      };
    }
    // 마지막 공격이 끝난 시점 — 연타 발동 가능 여부 검사.
    const interval = player.extraAttackEveryNTurns;
    const canDoubleStrike =
      !!interval &&
      interval > 0 &&
      turnNumber % interval === 0 &&
      !state.doubleStrikeUsedThisTurn;
    if (canDoubleStrike) {
      return {
        ...afterDamage,
        log: appendLog(afterDamage.log, { kind: "info", text: "[연타] 한 번 더!" }),
        phase: "player",
        playerAttacksLeft: 1,
        doubleStrikeUsedThisTurn: true,
        firstAttackPending: false,
      };
    }
    // 광속 — 마지막 공격 후 일정 확률로 추가 1회. 연타와 별개라 둘 다 슬롯 시
    // 한 턴에 +2 까지 발동 가능 (연타 → 광속 순서 — 연타가 먼저 빠져나간 다음 광속).
    const lightspeedPct = player.lightspeedExtraAttackPct ?? 0;
    const canLightspeed =
      lightspeedPct > 0 &&
      !state.lightspeedUsedThisTurn &&
      Math.random() * 100 < lightspeedPct;
    if (canLightspeed) {
      return {
        ...afterDamage,
        log: appendLog(afterDamage.log, {
          kind: "info",
          text: "[광속] 잔상이 한 번 더 휘둘렀다!",
        }),
        phase: "player",
        playerAttacksLeft: 1,
        lightspeedUsedThisTurn: true,
        firstAttackPending: false,
      };
    }
    // 연참 (특기) — 이번 턴에 크리티컬이 났으면 추가 공격 N회 (턴당 1회).
    const canRiposte =
      (player.riposteExtra ?? 0) > 0 &&
      !state.riposteUsedThisTurn &&
      afterDamage.critThisTurn;
    if (canRiposte) {
      return {
        ...afterDamage,
        log: appendLog(afterDamage.log, {
          kind: "info",
          text: "[연참] 빈틈을 파고든다 — 한 번 더!",
        }),
        phase: "player",
        playerAttacksLeft: player.riposteExtra!,
        riposteUsedThisTurn: true,
        firstAttackPending: false,
      };
    }
    const ended: BattleState = {
      ...afterDamage,
      phase: "enemy",
      playerAttacksLeft: rollPlayerAttackCount(player),
      completedPlayerTurns: state.completedPlayerTurns + 1,
      doubleStrikeUsedThisTurn: false,
      lightspeedUsedThisTurn: false,
      critThisTurn: false,
      riposteUsedThisTurn: false,
      firstAttackPending: true,
    };
    return finishPlayerTurn(ended, player, playerName);
  }

  // ── 출혈 (4티어) — 적 턴 시작 시 출혈 스택당 고정 피해 (DEF 무시) ──────────
  if (state.bleedStacks > 0 && (player.bleedDmgPerStack ?? 0) > 0) {
    const bleedDmg = state.bleedStacks * player.bleedDmgPerStack!;
    const afterBleedHp = Math.max(0, state.enemyHp - bleedDmg);
    const bled = applyPhaseTriggerIfAny({
      ...state,
      enemyHp: afterBleedHp,
      log: appendLog(state.log, {
        kind: "info",
        text: `[출혈] ${state.enemy.name}이(가) 출혈로 ${bleedDmg} 피해 (스택 ${state.bleedStacks})`,
      }),
    });
    if (afterBleedHp <= 0) {
      return {
        ...bled,
        log: appendLog(bled.log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
      };
    }
    state = bled;
  }

  // enemy phase — 보장 회피 → % 회피 → 행운의 방패 → 데미지 (가드 적용) 순.
  // enemy phase 종료 시 enemyPhasesCompleted +1 (가드 카운터 진행).
  // 회피/방패 성공 시 곡예(특기) 장착이면 HP +evadeHealAmount.
  const evadeHeal = player.evadeHealAmount ?? 0;
  const healOnDodge = (hp: number): number =>
    evadeHeal > 0 ? Math.min(state.playerMaxHp, hp + evadeHeal) : hp;
  if (state.evadesRemaining > 0) {
    const healedHp = healOnDodge(state.playerHp);
    let log = appendLog(state.log, {
      kind: "info",
      text: `[회피 강화] ${state.enemy.name}의 공격을 회피했다!`,
    });
    if (healedHp > state.playerHp) {
      log = appendLog(log, {
        kind: "info",
        text: `[곡예] ${playerName}의 HP +${healedHp - state.playerHp}`,
      });
    }
    let next: BattleState = {
      ...state,
      playerHp: healedHp,
      evadesRemaining: state.evadesRemaining - 1,
      enemyPhasesCompleted: state.enemyPhasesCompleted + 1,
      // 유격 (특기) — 회피 성공 시 다음 플레이어 턴 공격 횟수 +N (현재 playerAttacksLeft 는 다음 턴 선롤분).
      playerAttacksLeft:
        state.playerAttacksLeft + (player.skirmishNextTurnBonus ?? 0),
      log,
    };
    const counter = applyCounterIfAny(next, player);
    if (counter.ended) return counter.state;
    next = counter.state;
    return { ...next, phase: "player" };
  }
  // 이중 행운 — 활성 시 회피 확률 +bonus%.
  const luckEvadeBonus = state.luckyBuffActive
    ? player.doubleLuck?.evade ?? 0
    : 0;
  const effectiveEvadePct = player.evasionPct + luckEvadeBonus;
  if (Math.random() * 100 < effectiveEvadePct) {
    const healedHp = healOnDodge(state.playerHp);
    let log = appendLog(state.log, {
      kind: "info",
      text: `${playerName}이(가) ${state.enemy.name}의 공격을 회피했다!`,
    });
    if (healedHp > state.playerHp) {
      log = appendLog(log, {
        kind: "info",
        text: `[곡예] ${playerName}의 HP +${healedHp - state.playerHp}`,
      });
    }
    let next: BattleState = {
      ...state,
      playerHp: healedHp,
      enemyPhasesCompleted: state.enemyPhasesCompleted + 1,
      // 유격 (특기) — 회피 성공 시 다음 플레이어 턴 공격 횟수 +N (현재 playerAttacksLeft 는 다음 턴 선롤분).
      playerAttacksLeft:
        state.playerAttacksLeft + (player.skirmishNextTurnBonus ?? 0),
      log,
    };
    const counter = applyCounterIfAny(next, player);
    if (counter.ended) return counter.state;
    next = counter.state;
    return { ...next, phase: "player" };
  }
  // 행운의 방패 (특기) — 위 회피가 모두 실패해도 일정 확률로 피해 무효 (행운 회피).
  const luckyBlockPct = player.luckyShieldBlockPct ?? 0;
  if (luckyBlockPct > 0 && Math.random() * 100 < luckyBlockPct) {
    const healedHp = healOnDodge(state.playerHp);
    let log = appendLog(state.log, {
      kind: "info",
      text: `[행운의 방패] ${playerName}이(가) ${state.enemy.name}의 공격을 흘려보냈다!`,
    });
    if (healedHp > state.playerHp) {
      log = appendLog(log, {
        kind: "info",
        text: `[곡예] ${playerName}의 HP +${healedHp - state.playerHp}`,
      });
    }
    let next: BattleState = {
      ...state,
      playerHp: healedHp,
      enemyPhasesCompleted: state.enemyPhasesCompleted + 1,
      // 유격 (특기) — 회피 성공 시 다음 플레이어 턴 공격 횟수 +N (현재 playerAttacksLeft 는 다음 턴 선롤분).
      playerAttacksLeft:
        state.playerAttacksLeft + (player.skirmishNextTurnBonus ?? 0),
      log,
    };
    const counter = applyCounterIfAny(next, player);
    if (counter.ended) return counter.state;
    next = counter.state;
    return { ...next, phase: "player" };
  }

  // ── 잡몹 스킬 (적 공격에 영향) ──────────────────────────────────────────
  const skill = state.enemy.skill;
  // 격노 — 적 HP 가 maxHp×hpFraction 미만으로 떨어지는 순간 1회 발동, ATK +atkBonus (전투 종료까지 유지).
  const enrageReady =
    skill?.kind === "enrage" &&
    !state.enrageTriggered &&
    state.enemyHp > 0 &&
    state.enemyHp < state.enemy.hp * skill.hpFraction;
  const enemyAtkBonus =
    enrageReady && skill?.kind === "enrage"
      ? state.enemyAtkBonus + skill.atkBonus
      : state.enemyAtkBonus;
  const enrageTriggered = state.enrageTriggered || enrageReady;
  // 관통 — 이 적의 공격이 플레이어 DEF 를 armorPierce 만큼 무시.
  const effectivePlayerDef =
    skill?.kind === "pierce" ? Math.max(0, player.def - skill.armorPierce) : player.def;
  // 강타 — everyPhases 번째 적 페이즈마다 데미지 ×multiplier. 이번 페이즈 종료 후
  // enemyPhasesCompleted 가 N 의 배수가 되는지로 판단.
  const heavyBlowMult =
    skill?.kind === "heavy_blow" &&
    skill.everyPhases > 0 &&
    (state.enemyPhasesCompleted + 1) % skill.everyPhases === 0
      ? skill.multiplier
      : 1;
  const heavyBlowFired = heavyBlowMult > 1;
  const baseEnemyDmg = damageBetween(state.enemy.atk + enemyAtkBonus, effectivePlayerDef);
  const rawDmg = heavyBlowFired
    ? Math.max(1, Math.floor(baseEnemyDmg * heavyBlowMult))
    : baseEnemyDmg;
  // 가드 — 첫 N번의 적 페이즈 동안 받는 피해 -reduction. 선공자에 무관하게
  // enemyPhasesCompleted 가 N 미만이면 이번 페이즈가 그 N 중 하나.
  const guard = player.guard;
  const guarded =
    guard && guard.turns > 0 && state.enemyPhasesCompleted < guard.turns
      ? Math.max(0, rawDmg - guard.reduction)
      : rawDmg;
  const dmg = guarded;
  const guardApplied = guarded < rawDmg;
  // 철벽 (4티어) — 보호막이 데미지를 먼저 흡수, 남은 만큼만 HP 에 적용. 무피해 난무는 dmgToHp 로 누적.
  const shieldAbsorbed = Math.min(state.playerShield, dmg);
  const dmgToHp = dmg - shieldAbsorbed;
  const newShield = state.playerShield - shieldAbsorbed;
  // 불굴 — HP 0 이 되는 데미지를 HP 1 로 막는다. 전투당 1회 (enduranceTriggered).
  const wouldKill = state.playerHp - dmgToHp <= 0;
  const enduranceFires =
    wouldKill && !!player.enduranceActive && !state.enduranceTriggered;
  const playerHp = enduranceFires ? 1 : Math.max(0, state.playerHp - dmgToHp);
  const enduranceTriggered = state.enduranceTriggered || enduranceFires;
  // 로그 — 격노 발동 → 가드 → (강타 라벨 포함) 공격 → 불굴 순.
  let log = state.log;
  if (enrageReady && skill?.kind === "enrage") {
    log = appendLog(log, {
      kind: "info",
      text: `[${skill.name}] ${state.enemy.name}이(가) 격앙되어 공격력이 +${skill.atkBonus}!`,
    });
  }
  if (guardApplied) {
    log = appendLog(log, {
      kind: "info",
      text: `[가드] 피해 -${rawDmg - guarded}`,
    });
  }
  if (shieldAbsorbed > 0) {
    log = appendLog(log, {
      kind: "info",
      text: `[철벽] 보호막이 ${shieldAbsorbed} 흡수 (남은 ${newShield})`,
    });
  }
  const atkPrefix =
    heavyBlowFired && skill?.kind === "heavy_blow" ? `[${skill.name}] ` : "";
  log = appendLog(log, {
    kind: "enemy_attack",
    text: `${atkPrefix}${state.enemy.name}이(가) ${playerName}에게 ${dmgToHp} 피해를 입혔다.`,
  });
  if (enduranceFires) {
    log = appendLog(log, {
      kind: "info",
      text: `[불굴] 마지막 한 숨 — HP 1 로 버텼다!`,
    });
  }
  // 반사 갑주 (특기) — 받은 HP 피해의 N% 를 적에게 반사.
  const thornsDmg =
    (player.thornsPct ?? 0) > 0
      ? Math.floor((dmgToHp * player.thornsPct!) / 100)
      : 0;
  const enemyHpAfterThorns = Math.max(0, state.enemyHp - thornsDmg);
  if (thornsDmg > 0) {
    log = appendLog(log, {
      kind: "player_attack",
      text: `[반사 갑주] ${state.enemy.name}에게 ${thornsDmg} 반사 피해.`,
    });
  }
  if (playerHp <= 0) {
    return {
      ...state,
      playerHp,
      playerShield: newShield,
      damageTakenThisCombat: state.damageTakenThisCombat + dmgToHp,
      enduranceTriggered,
      enemyAtkBonus,
      enrageTriggered,
      enemyHp: enemyHpAfterThorns,
      enemyPhasesCompleted: state.enemyPhasesCompleted + 1,
      log: appendLog(log, {
        kind: "info",
        text: `${playerName}이(가) 쓰러졌다...`,
      }),
      phase: "ended",
      outcome: "lose",
    };
  }
  if (enemyHpAfterThorns <= 0) {
    // 반사 피해로 적이 쓰러짐 — 플레이어는 생존.
    return {
      ...state,
      playerHp,
      playerShield: newShield,
      damageTakenThisCombat: state.damageTakenThisCombat + dmgToHp,
      enduranceTriggered,
      enemyAtkBonus,
      enrageTriggered,
      enemyHp: 0,
      enemyPhasesCompleted: state.enemyPhasesCompleted + 1,
      log: appendLog(log, {
        kind: "info",
        text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
      }),
      phase: "ended",
      outcome: "win",
    };
  }
  return {
    ...state,
    playerHp,
    playerShield: newShield,
    damageTakenThisCombat: state.damageTakenThisCombat + dmgToHp,
    enduranceTriggered,
    enemyAtkBonus,
    enrageTriggered,
    enemyHp: enemyHpAfterThorns,
    enemyPhasesCompleted: state.enemyPhasesCompleted + 1,
    log,
    phase: "player",
  };
}

// 한 전투를 시작부터 끝까지 한 번에 시뮬한다. 결과(최종 상태 + 로그 + 턴 수 + 소비된 포션)만
// 반환하므로 실시간 UI/오프라인 시뮬 양쪽에서 동일하게 사용 가능.
//
// `pickAction`은 player phase에서 호출. 포션 사용 결정 시 호출 측에서 보유량 체크 X —
// 함수 내부에서 잔량을 추적하고 부족하면 attack으로 폴백한다.
export type ResolveContext = {
  pickAction: (state: BattleState) => PlayerAction;
  potions: Partial<Record<PotionId, number>>;
};

export type BattleResolution = {
  outcome: BattleOutcome;
  finalState: BattleState;
  potionsConsumed: Partial<Record<PotionId, number>>;
  turns: number;
};

export function resolveBattle(
  player: PlayerCombat,
  enemy: import("../data/monsters").Monster,
  playerName: string,
  ctx: ResolveContext,
): BattleResolution {
  const potions: Partial<Record<PotionId, number>> = { ...ctx.potions };
  const consumed: Partial<Record<PotionId, number>> = {};
  let state = initialBattleState(player, enemy, playerName);
  let turns = 0;

  while (state.phase !== "ended") {
    let action: PlayerAction = { kind: "attack" };
    if (state.phase === "player") {
      const picked = ctx.pickAction(state);
      if (picked.kind === "use_potion") {
        const have = potions[picked.potionId] ?? 0;
        if (have > 0) {
          potions[picked.potionId] = have - 1;
          consumed[picked.potionId] = (consumed[picked.potionId] ?? 0) + 1;
          action = picked;
        }
      } else {
        action = picked;
      }
    }
    state = advanceTurn(state, player, playerName, action);
    turns += 1;

    // 무한 루프 가드 — 정상 전투는 보통 수십 턴 안에 끝난다. 만약 데미지 0/회피 100% 같은
    // 병리적 조합이면 적의 타임아웃 패배로 강제 종료.
    if (turns > 500) {
      return {
        outcome: "lose",
        finalState: { ...state, phase: "ended", outcome: "lose" },
        potionsConsumed: consumed,
        turns,
      };
    }
  }

  return {
    outcome: state.outcome!,
    finalState: state,
    potionsConsumed: consumed,
    turns,
  };
}

// 물약 효과 적용 — 순수 함수. 인벤토리 차감은 호출 측 책임.
export function applyPotionEffect(
  state: BattleState,
  potion: Potion,
  playerName: string,
): BattleState {
  if (potion.effect.kind === "heal_hp") {
    const heal = computeHealAmount(potion, state.playerMaxHp);
    const newHp = Math.min(state.playerMaxHp, state.playerHp + heal);
    const actual = newHp - state.playerHp;
    return {
      ...state,
      playerHp: newHp,
      log: appendLog(state.log, {
        kind: "info",
        text: `${playerName}이(가) ${potion.name}을(를) 마셨다 — HP +${actual} (${state.playerHp} → ${newHp})`,
      }),
    };
  }
  return state;
}
