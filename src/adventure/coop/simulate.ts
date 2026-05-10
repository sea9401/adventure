// 협동 보스 1회 공격 시뮬 — engine.ts 의 advanceTurn 을 N턴 굴려 누적 데미지·플레이어 HP 반영.
// 보스가 반격하므로 플레이어가 사망할 수 있다 (캐릭터 hp 0).
//
// 솔로 보스 BattleView 와 다른 점:
// - 1회 호출당 정해진 턴수만 (COOP_ATTACK_TURNS).
// - 보스 hp 는 호출자가 maxHp/현재hp 를 외부에서 관리 (시뮬은 stateless 데미지 산출).
// - 시뮬 결과의 enemyHp 변화량을 "플레이어가 가한 데미지" 로 환산.

import {
  advanceTurn,
  initialBattleState,
  type BattleLogEntry,
  type PlayerCombat,
} from "@/adventure/battle/engine";
import { MONSTERS, type Monster } from "@/adventure/data/monsters";

export type CoopAttackResult = {
  damageDealt: number;
  damageTaken: number;
  finalPlayerHp: number;
  diedEarly: boolean;
  log: BattleLogEntry[];
};

export type CoopAttackInput = {
  player: PlayerCombat;
  playerName: string;
  /** 보스 monster 키 — MONSTERS 에서 stat 가져옴. */
  bossName: string;
  /** 협동 세션의 현재 hp (이 시뮬 시작 시점). */
  bossCurrentHp: number;
  /** 협동 세션의 maxHp (페이즈 트리거 비율 계산용). */
  bossMaxHp: number;
  /** 시뮬 턴수. 기본 COOP_ATTACK_TURNS. */
  turns: number;
};

/**
 * 1회 공격 시뮬:
 * - bossCurrentHp 부터 시작해 N턴 또는 한쪽 사망까지 진행.
 * - damageDealt = (시작 hp − 종료 hp) — 호출자가 세션 hp 를 차감하는 데 사용.
 * - 플레이어 사망 시 finalPlayerHp = 0.
 * - 보스 페이즈 트리거는 maxHp 기준으로 발동 (협동 큰 hp 에 맞춤).
 */
export function simulateCoopAttack(input: CoopAttackInput): CoopAttackResult {
  const baseMonster = MONSTERS[input.bossName];
  if (!baseMonster) {
    throw new Error(`unknown boss: ${input.bossName}`);
  }

  // 협동 hp 로 override — phaseTrigger 가 fraction 기반이라 maxHp 그대로 두면 동작.
  // engine.ts 는 enemy.hp 를 maxHp 로 취급해 phaseTrigger threshold 계산.
  const bossForBattle: Monster = { ...baseMonster, hp: input.bossMaxHp };

  let state = initialBattleState(
    { ...input.player },
    bossForBattle,
    input.playerName,
  );
  // 시작 시점 보스 hp 를 협동 세션의 현재 hp 로 덮어쓴다.
  // (initialBattleState 가 maxHp 로 시작하므로, 진행 중 세션은 그 차이만큼 감소된 상태로 입장)
  // 페이즈 트리거는 hp 비율로 implicit — 이미 threshold 아래면 발동된 것으로 간주.
  // (그렇지 않으면 매 공격마다 트리거 메시지가 다시 노출됨)
  const trigger = bossForBattle.phaseTrigger;
  const alreadyTriggered =
    !!trigger &&
    input.bossCurrentHp < bossForBattle.hp * trigger.hpFraction;
  state = {
    ...state,
    enemyHp: input.bossCurrentHp,
    phaseTriggered: alreadyTriggered,
    enemyDefBonus: alreadyTriggered ? trigger.defBonus : 0,
  };

  const log: BattleLogEntry[] = [];
  let turnsRun = 0;
  const maxTurns = input.turns;

  while (
    state.phase !== "ended" &&
    turnsRun < maxTurns &&
    state.playerHp > 0 &&
    state.enemyHp > 0
  ) {
    state = advanceTurn(state, input.player, input.playerName, { kind: "attack" });
    // 한 player turn + enemy turn 이 한 사이클이지만 advanceTurn 은 phase 단위로 진행.
    // 한 사이클 (player → enemy → 다시 player) 을 1 turn 으로 카운트 — phase 가 player 로 돌아올 때 +1.
    if (state.phase === "player") turnsRun += 1;
  }

  // log 추출 — engine 이 state.log 에 누적.
  for (const entry of state.log) log.push(entry);

  const damageDealt = Math.max(0, input.bossCurrentHp - state.enemyHp);
  const damageTaken = Math.max(0, input.player.hp - state.playerHp);

  return {
    damageDealt,
    damageTaken,
    finalPlayerHp: Math.max(0, state.playerHp),
    diedEarly: state.playerHp <= 0,
    log,
  };
}
