import type { Monster } from "../data/monsters";
import { computeHealAmount, type Potion, type PotionId } from "../data/potions";
import { CRIT_MULT, POWER_ATTACK_TURN_INTERVAL } from "../character/skills";

export type BattleLogEntry = {
  kind: "player_attack" | "enemy_attack" | "info";
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
  // 회피 강화로 적립된 보장 회피 잔량 — enemy phase 에서 % 회피 판정 전에 우선 소모.
  evadesRemaining: number;
  // 연타가 한 턴에 한 번만 발동하도록 막는 게이트 — 새 턴 시작 시 false 로 리셋.
  doubleStrikeUsedThisTurn: boolean;
  // 이중 행운 — 첫 크리 발동 시 true 로 전환, 전투 종료까지 유지. 회피/크리 보너스 적용 게이트.
  luckyBuffActive: boolean;
  // 그 턴의 첫 공격이 아직 안 나갔는지 — 강공격(첫 공격에만 보너스) 트리거에 사용.
  // 새 턴 시작 시 true, 첫 공격 후 false. 연타(같은 턴 연장)에는 영향 없음.
  firstAttackPending: boolean;
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
  // 이중 행운 — 첫 크리 발동 시 회피/크리 +bonus% 발동, 전투 종료까지 유지. 0 이면 미보유.
  doubleLuck?: { evade: number; crit: number };
  // 가드 — 첫 N턴 동안 받는 피해 -reduction. 둘 다 0 이면 스킬 미보유.
  guard?: { turns: number; reduction: number };
  // 재생 — interval 턴마다 HP +amount. 둘 다 0 이면 스킬 미보유.
  regen?: { interval: number; amount: number };
};

export type PlayerAction =
  | { kind: "attack" }
  | { kind: "use_potion"; potionId: PotionId; potion: Potion };

const LOG_LIMIT = 8;

export function appendLog(
  log: BattleLogEntry[],
  entry: BattleLogEntry,
): BattleLogEntry[] {
  const next = [...log, entry];
  if (next.length > LOG_LIMIT) next.splice(0, next.length - LOG_LIMIT);
  return next;
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

// 반격 — 회피 직후 카운터 1회. 적이 죽으면 ended 로 종료.
// crit / 강공격 등은 적용하지 않음 — 별도 단순 데미지.
function applyCounterIfAny(
  state: BattleState,
  player: PlayerCombat,
): { state: BattleState; ended: boolean } {
  const bonus = player.counterAtkBonus ?? 0;
  if (bonus <= 0) return { state, ended: false };
  const dmg = damageBetween(player.atk + bonus, state.enemy.def);
  const enemyHp = Math.max(0, state.enemyHp - dmg);
  const log = appendLog(state.log, {
    kind: "player_attack",
    text: `[반격] ${state.enemy.name}에게 ${dmg} 피해를 입혔다.`,
  });
  if (enemyHp <= 0) {
    return {
      state: {
        ...state,
        enemyHp,
        log: appendLog(log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
      },
      ended: true,
    };
  }
  return { state: { ...state, enemyHp, log }, ended: false };
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
    evadesRemaining: player.guaranteedEvades ?? 0,
    doubleStrikeUsedThisTurn: false,
    luckyBuffActive: false,
    firstAttackPending: true,
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
    const enemyEvasionPct = state.enemy.evasionPct ?? 0;
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
        firstAttackPending: true,
      };
      return applyRegenIfAny(ended, player, playerName);
    }

    // 분쇄 — 강공격 발동 턴, 그 공격에 한해 적 DEF -crushDefReduction.
    const crushReduction = player.crushDefReduction ?? 0;
    const targetDef =
      bonus > 0 && crushReduction > 0
        ? Math.max(0, state.enemy.def - crushReduction)
        : state.enemy.def;
    // 크리티컬 — 매 공격마다 critChancePct 확률로 발동. 이중 행운 발동 후엔 +crit 보너스.
    const baseCritPct = player.critChancePct ?? 0;
    const luckCritBonus = state.luckyBuffActive
      ? player.doubleLuck?.crit ?? 0
      : 0;
    const effectiveCritPct = baseCritPct + luckCritBonus;
    const critRoll =
      effectiveCritPct > 0 ? Math.random() * 100 < effectiveCritPct : false;
    const baseDmg = damageBetween(player.atk + bonus, targetDef);
    const dmg = critRoll ? Math.floor(baseDmg * CRIT_MULT) : baseDmg;
    const labels: string[] = [];
    if (bonus > 0) labels.push("강공격");
    if (bonus > 0 && crushReduction > 0) labels.push("분쇄");
    if (critRoll) labels.push("크리티컬");
    const prefix = labels.length > 0 ? `[${labels.join(" + ")}] ` : "";
    let log = appendLog(state.log, {
      kind: "player_attack",
      text: `${prefix}${state.enemy.name}에게 ${dmg} 피해를 입혔다.`,
    });
    // 이중 행운 — 첫 크리 발동 순간 활성화, 후속 공격/회피 부터 보너스 적용.
    const shouldActivateLucky =
      critRoll &&
      !state.luckyBuffActive &&
      (player.doubleLuck?.crit ?? 0) > 0;
    if (shouldActivateLucky) {
      log = appendLog(log, {
        kind: "info",
        text: `[이중 행운] 회피/크리 +${player.doubleLuck!.crit}% 발동!`,
      });
    }
    const luckyBuffActive = state.luckyBuffActive || shouldActivateLucky;
    const enemyHp = Math.max(0, state.enemyHp - dmg);
    if (enemyHp <= 0) {
      return {
        ...state,
        enemyHp,
        log: appendLog(log, {
          kind: "info",
          text: `${state.enemy.name}을(를) 쓰러뜨렸다!`,
        }),
        phase: "ended",
        outcome: "win",
        completedPlayerTurns: state.completedPlayerTurns + 1,
        luckyBuffActive,
      };
    }
    const attacksLeft = state.playerAttacksLeft - 1;
    if (attacksLeft > 0) {
      return {
        ...state,
        enemyHp,
        log,
        playerAttacksLeft: attacksLeft,
        luckyBuffActive,
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
        ...state,
        enemyHp,
        log: appendLog(log, { kind: "info", text: "[연타] 한 번 더!" }),
        phase: "player",
        playerAttacksLeft: 1,
        doubleStrikeUsedThisTurn: true,
        luckyBuffActive,
        firstAttackPending: false,
      };
    }
    const ended: BattleState = {
      ...state,
      enemyHp,
      log,
      phase: "enemy",
      playerAttacksLeft: rollPlayerAttackCount(player),
      completedPlayerTurns: state.completedPlayerTurns + 1,
      doubleStrikeUsedThisTurn: false,
      luckyBuffActive,
      firstAttackPending: true,
    };
    return applyRegenIfAny(ended, player, playerName);
  }

  // enemy phase — 보장 회피 → % 회피 → 데미지 (가드 적용) 순.
  if (state.evadesRemaining > 0) {
    let next: BattleState = {
      ...state,
      evadesRemaining: state.evadesRemaining - 1,
      log: appendLog(state.log, {
        kind: "info",
        text: `[회피 강화] ${state.enemy.name}의 공격을 회피했다!`,
      }),
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
    let next: BattleState = {
      ...state,
      log: appendLog(state.log, {
        kind: "info",
        text: `${playerName}이(가) ${state.enemy.name}의 공격을 회피했다!`,
      }),
    };
    const counter = applyCounterIfAny(next, player);
    if (counter.ended) return counter.state;
    next = counter.state;
    return { ...next, phase: "player" };
  }

  const rawDmg = damageBetween(state.enemy.atk, player.def);
  // 가드 — 첫 N턴 동안 받는 피해 -reduction. completedPlayerTurns 기준
  // (현재 턴은 아직 미완 → 첫 턴 enemy phase 도 0 < N 이라 적용됨).
  const guard = player.guard;
  const guarded =
    guard && guard.turns > 0 && state.completedPlayerTurns < guard.turns
      ? Math.max(0, rawDmg - guard.reduction)
      : rawDmg;
  const dmg = guarded;
  const playerHp = Math.max(0, state.playerHp - dmg);
  const guardApplied = guarded < rawDmg;
  const log = guardApplied
    ? appendLog(
        appendLog(state.log, {
          kind: "info",
          text: `[가드] 피해 -${rawDmg - guarded}`,
        }),
        {
          kind: "enemy_attack",
          text: `${state.enemy.name}이(가) ${playerName}에게 ${dmg} 피해를 입혔다.`,
        },
      )
    : appendLog(state.log, {
        kind: "enemy_attack",
        text: `${state.enemy.name}이(가) ${playerName}에게 ${dmg} 피해를 입혔다.`,
      });
  if (playerHp <= 0) {
    return {
      ...state,
      playerHp,
      log: appendLog(log, {
        kind: "info",
        text: `${playerName}이(가) 쓰러졌다...`,
      }),
      phase: "ended",
      outcome: "lose",
    };
  }
  return { ...state, playerHp, log, phase: "player" };
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
