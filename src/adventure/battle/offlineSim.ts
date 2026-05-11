// 오프라인 자동 사냥 시뮬레이션.
// 페이지가 background/closed 상태인 동안에는 JS가 돌지 못하므로,
// 사용자가 돌아왔을 때 "그 동안 일어났을 일"을 결정적으로 한 번에 계산해 보상으로 지급한다.
//
// 정확성보다 일관성/단순성을 우선:
// - engine.ts의 advanceTurn 그대로 재사용 — 실시간 자동 전투와 결과 분포 동일
// - 한 턴당 시간 비용은 useBattle의 TURN_INTERVAL_MS(0.5s)를 그대로 사용
// - 시뮬 가능 시간은 OFFLINE_SIM_MAX_MS(1시간)로 cap — 오래 자리비워도 그 이상은 보상 없음

import { pickEnemyName, type Region } from "../data/world";
import { MONSTERS } from "../data/monsters";
import { POTIONS, type PotionId } from "../data/potions";
import { type MaterialId } from "../data/materials";
import { type ItemId } from "../data/items";
import {
  advanceTurn,
  initialBattleState,
  type BattleState,
  type PlayerAction,
  type PlayerCombat,
} from "./engine";
import { applyExpGain, applyNewbieBonus } from "@/lib/leveling";

export const OFFLINE_SIM_MAX_MS = 60 * 60 * 1000;

export type OfflineSimInput = {
  player: PlayerCombat;
  playerName: string;
  region: Region;
  /** 신참 보너스(<8) 판정 시작 레벨. 사이클 중 누적 EXP 로 레벨업하면 그 시점부터 보너스 OFF. */
  playerLevel: number;
  /** 시뮬 시작 시점의 누적 EXP — 사이클 중 레벨업 판정에 사용. 미지정 시 0. */
  playerExp?: number;
  potions: Partial<Record<PotionId, number>>;
  // 한 턴(player or enemy)당 흘러간 것으로 칠 시간. 보통 PLAYER_TURN_INTERVAL_MS.
  turnIntervalMs: number;
  // 페이지 비운 실제 시간(ms). cap 미적용 raw 값.
  awayMs: number;
  // 자동 행동 결정 — pickAutoAction을 그대로 주입.
  pickAction: (state: BattleState) => PlayerAction;
  // 드롭률 보정 — onBattleEnd 와 동일 공식 (1 + luk*0.01, cap 1.0).
  luk: number;
  // 이미 보유 중인 제작서 판정. recipe 드롭은 미보유 상태에서만 학습.
  knowsRecipe: (recipeId: string) => boolean;
  // 적 선택 + 드롭 굴림에 쓰일 RNG. 테스트에서 시드 가능.
  rng?: () => number;
};

export type OfflineSimResult = {
  simulatedMs: number; // 실제 시뮬레이션된 시간 (cap 적용)
  cappedByLimit: boolean; // OFFLINE_SIM_MAX_MS에 걸렸는지
  battles: number; // 끝까지 진행된 전투 수
  wins: number;
  killsByName: Record<string, number>;
  expGained: number;
  /** 신참 보너스가 한 번이라도 적용됐는지 — UI 배지용. */
  expBonusApplied: boolean;
  goldGained: number;
  materialsGained: Partial<Record<MaterialId, number>>;
  equipsGained: ItemId[]; // 같은 아이템 여러 개면 중복 push.
  recipesLearned: string[]; // 미보유였던 것만 — onApply 가 그대로 learn 호출.
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
    expBonusApplied: false,
    goldGained: 0,
    materialsGained: {},
    equipsGained: [],
    recipesLearned: [],
    potionsConsumed: {},
    finalPlayerHp: input.player.hp,
    died: false,
  };

  if (cap <= 0) return result;
  if (input.region.enemies.length === 0) return result;

  const potions: Partial<Record<PotionId, number>> = { ...input.potions };
  // 같은 사이클 안에서 같은 제작서를 두 번 굴려 중복 학습되지 않도록.
  const learnedThisSim = new Set<string>();
  const luckMultiplier = 1 + input.luk * 0.01;
  let currentHp = input.player.hp;
  let elapsed = 0;
  // 신참 보너스 ×2 판정용 — 매 처치마다 누적 EXP 로 레벨업 추적.
  // 레벨이 임계치 (5) 도달하는 순간부터 다음 처치에는 보너스 OFF.
  let runningLevel = input.playerLevel;
  let runningExp = input.playerExp ?? 0;

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
        const expBonus = applyNewbieBonus(enemy.exp, runningLevel);
        result.expGained += expBonus.gained;
        if (expBonus.bonusApplied) result.expBonusApplied = true;
        // 누적 EXP → 레벨 재계산. 다음 처치는 갱신된 runningLevel 로 보너스 판정.
        const after = applyExpGain(runningLevel, runningExp, expBonus.gained);
        runningLevel = after.level;
        runningExp = after.exp;
        // 드롭 — onBattleEnd 와 동일 로직(LUK 멀티 + cap 1.0).
        if (enemy.drops) {
          for (const drop of enemy.drops) {
            const adjustedChance = Math.min(1, drop.chance * luckMultiplier);
            if (rng() >= adjustedChance) continue;
            if (drop.kind === "material") {
              const amount = drop.amount ?? 1;
              result.materialsGained[drop.materialId] =
                (result.materialsGained[drop.materialId] ?? 0) + amount;
            } else if (drop.kind === "gold") {
              result.goldGained += drop.amount;
            } else if (drop.kind === "equip") {
              result.equipsGained.push(drop.itemId);
            } else if (drop.kind === "recipe") {
              if (
                input.knowsRecipe(drop.recipeId) ||
                learnedThisSim.has(drop.recipeId)
              )
                continue;
              learnedThisSim.add(drop.recipeId);
              result.recipesLearned.push(drop.recipeId);
            } else if (drop.kind === "recipe_one_of") {
              if (drop.recipeIds.length === 0) continue;
              // 풀에서 미보유만 추리고 그 안에서 균등 추첨 — 이미 아는 항목으로 뽑혀
              // 빈손이 되는 사고 방지. 같은 sim 안의 직전 학습도 미보유 풀에서 제외.
              const unknown = drop.recipeIds.filter(
                (id) => !input.knowsRecipe(id) && !learnedThisSim.has(id),
              );
              if (unknown.length === 0) continue;
              const pick = unknown[Math.floor(rng() * unknown.length)];
              learnedThisSim.add(pick);
              result.recipesLearned.push(pick);
            }
          }
        }
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
  if (r.expGained > 0)
    parts.push(`EXP +${r.expGained}${r.expBonusApplied ? " (신참 ×2)" : ""}`);
  if (r.goldGained > 0) parts.push(`골드 +${r.goldGained}`);
  const dropCount =
    Object.values(r.materialsGained).reduce((a, b) => a + (b ?? 0), 0) +
    r.equipsGained.length +
    r.recipesLearned.length;
  if (dropCount > 0) parts.push(`드롭 ${dropCount}`);
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
