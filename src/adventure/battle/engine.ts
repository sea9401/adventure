import type { Monster } from "../data/monsters";
import { computeHealAmount, type Potion, type PotionId } from "../data/potions";
import { POWER_ATTACK_TURN_INTERVAL } from "../character/skills";

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
};

export type PlayerCombat = {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number; // 선공 판정에 사용
  evasionPct: number; // 0~100, 적 공격 회피 확률
  attackCount: number; // 한 턴에 가하는 공격 횟수 (>=1)
  // 강공격 보너스 — POWER_ATTACK_TURN_INTERVAL 턴마다 첫 공격에 추가 피해. 0/undefined = 스킬 미보유.
  powerAttackBonus?: number;
  // 회피 강화 — 전투 시작 시 적립할 보장 회피 횟수. 0/undefined = 스킬 미보유.
  guaranteedEvades?: number;
  // 연타 — N턴마다 그 턴 마지막 공격 후 추가 1회 공격. undefined = 스킬 미보유.
  extraAttackEveryNTurns?: number;
  // 크리티컬 — 매 공격마다 발동 확률(0~100). 0/undefined = 스킬 미보유.
  critChancePct?: number;
  // 가드 — 첫 N턴 동안 받는 피해 -reduction. 둘 다 0 이면 스킬 미보유.
  guard?: { turns: number; reduction: number };
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

// 선공 — SPD가 높은 쪽이 먼저 공격. 동점이면 플레이어 우선.
export function initialBattleState(
  player: PlayerCombat,
  enemy: Monster,
  playerName: string,
): BattleState {
  const playerFirst = player.spd >= enemy.spd;
  const initiator = playerFirst ? playerName : enemy.name;
  return {
    enemy,
    enemyHp: enemy.hp,
    playerHp: player.hp,
    playerMaxHp: player.maxHp,
    log: [
      {
        kind: "info",
        text: `${enemy.name}이(가) 나타났다!`,
      },
      {
        kind: "info",
        text: `${initiator}의 선공.`,
      },
    ],
    phase: playerFirst ? "player" : "enemy",
    outcome: null,
    playerAttacksLeft: Math.max(1, player.attackCount),
    completedPlayerTurns: 0,
    evadesRemaining: player.guaranteedEvades ?? 0,
    doubleStrikeUsedThisTurn: false,
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
        playerAttacksLeft: Math.max(1, player.attackCount),
      };
    }

    // 강공격 발동 — POWER_ATTACK_TURN_INTERVAL 턴마다 그 턴의 첫 공격이 ATK + bonus.
    // 진행 중인 턴 번호 = completedPlayerTurns + 1. 첫 공격 = playerAttacksLeft 가 attackCount 와 같을 때.
    const turnNumber = state.completedPlayerTurns + 1;
    const isFirstAttackOfTurn =
      state.playerAttacksLeft === Math.max(1, player.attackCount);
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
        return { ...state, log, playerAttacksLeft: attacksLeft };
      }
      return {
        ...state,
        log,
        phase: "enemy",
        playerAttacksLeft: Math.max(1, player.attackCount),
        completedPlayerTurns: state.completedPlayerTurns + 1,
        doubleStrikeUsedThisTurn: false,
      };
    }

    // 크리티컬 — 매 공격마다 critChancePct 확률로 발동, 강공격 보너스 후 데미지에 ×CRIT_MULT.
    const critRoll = (player.critChancePct ?? 0) > 0
      ? Math.random() * 100 < (player.critChancePct ?? 0)
      : false;
    const baseDmg = damageBetween(player.atk + bonus, state.enemy.def);
    const dmg = critRoll ? baseDmg * 2 : baseDmg;
    const labels: string[] = [];
    if (bonus > 0) labels.push("강공격");
    if (critRoll) labels.push("크리티컬");
    const prefix = labels.length > 0 ? `[${labels.join(" + ")}] ` : "";
    const log = appendLog(state.log, {
      kind: "player_attack",
      text: `${prefix}${state.enemy.name}에게 ${dmg} 피해를 입혔다.`,
    });
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
      };
    }
    const attacksLeft = state.playerAttacksLeft - 1;
    if (attacksLeft > 0) {
      return { ...state, enemyHp, log, playerAttacksLeft: attacksLeft };
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
      };
    }
    return {
      ...state,
      enemyHp,
      log,
      phase: "enemy",
      playerAttacksLeft: Math.max(1, player.attackCount),
      completedPlayerTurns: state.completedPlayerTurns + 1,
      doubleStrikeUsedThisTurn: false,
    };
  }

  // enemy phase — 보장 회피 → % 회피 → 데미지 (가드 적용) 순.
  if (state.evadesRemaining > 0) {
    return {
      ...state,
      evadesRemaining: state.evadesRemaining - 1,
      log: appendLog(state.log, {
        kind: "info",
        text: `[회피 강화] ${state.enemy.name}의 공격을 회피했다!`,
      }),
      phase: "player",
    };
  }
  if (Math.random() * 100 < player.evasionPct) {
    return {
      ...state,
      log: appendLog(state.log, {
        kind: "info",
        text: `${playerName}이(가) ${state.enemy.name}의 공격을 회피했다!`,
      }),
      phase: "player",
    };
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
