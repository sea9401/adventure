// 오프라인 자동 사냥 시뮬레이션.
// 페이지가 background/closed 상태인 동안에는 JS가 돌지 못하므로,
// 사용자가 돌아왔을 때 "그 동안 일어났을 일"을 결정적으로 한 번에 계산해 보상으로 지급한다.
//
// 정확성보다 일관성/단순성을 우선:
// - engine.ts의 advanceTurn 그대로 재사용 — 실시간 자동 전투와 결과 분포 동일
// - 한 턴당 시간 비용은 useBattle의 TURN_INTERVAL_MS(0.5s)를 그대로 사용
// - 시뮬 가능 시간은 OFFLINE_SIM_MAX_MS(30분)로 cap — 오래 자리비워도 그 이상은 보상 없음

import { pickEnemyName, type Region } from "../data/world";
import { MONSTERS } from "../data/monsters";
import { POTIONS, type PotionId } from "../data/potions";
import {
  advanceTurn,
  initialBattleState,
  type BattleState,
  type PlayerAction,
  type PlayerCombat,
} from "./engine";

export const OFFLINE_SIM_MAX_MS = 30 * 60 * 1000;

export type OfflineSimInput = {
  player: PlayerCombat;
  playerName: string;
  region: Region;
  potions: Partial<Record<PotionId, number>>;
  // 한 턴(player or enemy)당 흘러간 것으로 칠 시간. 보통 PLAYER_TURN_INTERVAL_MS.
  turnIntervalMs: number;
  // 페이지 비운 실제 시간(ms). cap 미적용 raw 값.
  awayMs: number;
  // 자동 행동 결정 — pickAutoAction을 그대로 주입.
  pickAction: (state: BattleState) => PlayerAction;
  // 적 선택 + 회피 등에 쓰일 RNG. 테스트에서 시드 가능.
  rng?: () => number;
};

export type OfflineSimResult = {
  simulatedMs: number; // 실제 시뮬레이션된 시간 (cap 적용)
  cappedByLimit: boolean; // OFFLINE_SIM_MAX_MS에 걸렸는지
  battles: number; // 끝까지 진행된 전투 수
  wins: number;
  killsByName: Record<string, number>;
  expGained: number;
  potionsConsumed: Partial<Record<PotionId, number>>;
  finalPlayerHp: number;
  died: boolean; // 도중 사망?
};

export function simulateOfflineHunt(input: OfflineSimInput): OfflineSimResult {
  const cap = Math.min(input.awayMs, OFFLINE_SIM_MAX_MS);
  const cappedByLimit = input.awayMs > OFFLINE_SIM_MAX_MS;
  const rng = input.rng ?? Math.random;

  const result: OfflineSimResult = {
    simulatedMs: 0,
    cappedByLimit,
    battles: 0,
    wins: 0,
    killsByName: {},
    expGained: 0,
    potionsConsumed: {},
    finalPlayerHp: input.player.hp,
    died: false,
  };

  if (cap <= 0) return result;
  if (input.region.enemies.length === 0) return result;

  const potions: Partial<Record<PotionId, number>> = { ...input.potions };
  let currentHp = input.player.hp;
  let elapsed = 0;

  while (elapsed < cap && currentHp > 0) {
    const enemyName = pickEnemyName(input.region, rng);
    if (!enemyName) break;
    const enemy = MONSTERS[enemyName];
    if (!enemy) break;

    const playerForBattle: PlayerCombat = { ...input.player, hp: currentHp };
    let state = initialBattleState(playerForBattle, enemy, input.playerName);
    let battleFinished = false;

    while (state.phase !== "ended") {
      // 한 턴이 흘러갔다고 침. cap 초과면 진행 중인 전투는 미완으로 폐기.
      if (elapsed + input.turnIntervalMs > cap) {
        elapsed = cap;
        break;
      }
      elapsed += input.turnIntervalMs;

      let action: PlayerAction = { kind: "attack" };
      if (state.phase === "player") {
        const picked = input.pickAction(state);
        if (picked.kind === "use_potion") {
          const have = potions[picked.potionId] ?? 0;
          if (have > 0) {
            potions[picked.potionId] = have - 1;
            result.potionsConsumed[picked.potionId] =
              (result.potionsConsumed[picked.potionId] ?? 0) + 1;
            action = picked;
          } else {
            // 보유량 0이면 자동으로 공격으로 폴백 (실시간 useBattle와 동일).
            action = { kind: "attack" };
          }
        } else {
          action = picked;
        }
      }

      state = advanceTurn(state, playerForBattle, input.playerName, action);
    }

    if (state.phase === "ended") {
      battleFinished = true;
      result.battles += 1;
      if (state.outcome === "win") {
        result.wins += 1;
        result.killsByName[enemyName] =
          (result.killsByName[enemyName] ?? 0) + 1;
        result.expGained += enemy.exp;
        currentHp = state.playerHp;
      } else {
        currentHp = 0;
        result.died = true;
        break;
      }
    }
    if (!battleFinished) break;
  }

  result.simulatedMs = elapsed;
  result.finalPlayerHp = currentHp;
  return result;
}

// 알림 문구로 합치기 좋은 한 줄 요약. 비어있으면 빈 문자열.
export function summarizeOfflineResult(r: OfflineSimResult): string {
  if (r.battles === 0 && !r.died) return "";
  const parts: string[] = [];
  if (r.wins > 0) parts.push(`처치 ${r.wins}`);
  if (r.expGained > 0) parts.push(`EXP +${r.expGained}`);
  const usedPotions = Object.entries(r.potionsConsumed).filter(
    ([, n]) => (n ?? 0) > 0,
  );
  if (usedPotions.length > 0) {
    const txt = usedPotions
      .map(([id, n]) => {
        const name = POTIONS[id as PotionId]?.name ?? id;
        return `${name} ×${n}`;
      })
      .join(", ");
    parts.push(`소비 ${txt}`);
  }
  if (r.died) parts.push("사망");
  return parts.join(" · ");
}
