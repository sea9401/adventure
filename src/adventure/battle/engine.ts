import type { Monster } from "../data/monsters";

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
};

export type PlayerCombat = {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number; // 선공 판정에 사용
  evasionPct: number; // 0~100, 적 공격 회피 확률
  attackCount: number; // 한 턴에 가하는 공격 횟수 (>=1)
};

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
  };
}

// 한 턴 진행 — 현재 phase 측이 공격하고 결과를 다음 BattleState로 반환.
// player phase는 attackCount 만큼 연속 공격(턴마다 1회씩 분리해서 로그에 기록).
// phase === "ended" 이면 그대로 반환.
export function advanceTurn(
  state: BattleState,
  player: PlayerCombat,
  playerName: string,
): BattleState {
  if (state.phase === "ended") return state;

  if (state.phase === "player") {
    const dmg = damageBetween(player.atk, state.enemy.def);
    const enemyHp = Math.max(0, state.enemyHp - dmg);
    const log = appendLog(state.log, {
      kind: "player_attack",
      text: `${state.enemy.name}에게 ${dmg} 피해를 입혔다.`,
    });
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
      };
    }
    const attacksLeft = state.playerAttacksLeft - 1;
    if (attacksLeft > 0) {
      return { ...state, enemyHp, log, playerAttacksLeft: attacksLeft };
    }
    return {
      ...state,
      enemyHp,
      log,
      phase: "enemy",
      playerAttacksLeft: Math.max(1, player.attackCount),
    };
  }

  // enemy phase — 회피 판정 후 데미지 처리
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

  const dmg = damageBetween(state.enemy.atk, player.def);
  const playerHp = Math.max(0, state.playerHp - dmg);
  const log = appendLog(state.log, {
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
