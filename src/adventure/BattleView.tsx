"use client";

import { useEffect, useRef } from "react";
import type { Region } from "./data/world";
import { MONSTERS, type Monster } from "./data/monsters";
import type {
  BattleOutcome,
  BattleState,
  PlayerAction,
  PlayerCombat,
} from "./battle/engine";
import { useBattle, PLAYER_TURN_INTERVAL_MS } from "./battle/useBattle";
import { BattleScene } from "./battle/BattleScene";
import { BattleResult } from "./battle/BattleResult";
import { EnemyEncounterSection } from "./EnemyEncounterSection";
import type { PotionId } from "./data/potions";
import type { InventoryState } from "./inventory/useInventory";
import type {
  AutoPotionConfig,
  AutoPotionRule,
} from "./inventory/useAutoPotionConfig";
import { AutoPotionSection } from "./inventory/AutoPotionSection";
import { Card } from "@/components/ui/Card";

const RESULT_AUTO_CONFIRM_MS = 1200;

export type BattleEndPayload = {
  outcome: BattleOutcome;
  enemyName: string;
  finalPlayerHp: number;
  rewards: { exp: number };
};

function pickEnemy(region: Region): Monster | null {
  if (region.enemies.length === 0) return null;
  const name = region.enemies[Math.floor(Math.random() * region.enemies.length)];
  return MONSTERS[name] ?? null;
}

export function BattleView({
  region,
  player,
  playerName,
  onBattleStart,
  onBattleEnd,
  consumePotion,
  pickAutoAction,
  inventoryState,
  autoPotionConfig,
  onUpdateAutoPotionRule,
}: {
  region: Region;
  player: PlayerCombat;
  playerName: string;
  onBattleStart?: (enemyName: string) => void;
  onBattleEnd: (payload: BattleEndPayload) => void;
  consumePotion: (id: PotionId) => boolean;
  pickAutoAction: (state: BattleState) => PlayerAction;
  inventoryState: InventoryState;
  autoPotionConfig: AutoPotionConfig;
  onUpdateAutoPotionRule: (
    index: number,
    patch: Partial<AutoPotionRule>,
  ) => void;
}) {
  const { state, start, stop, act } = useBattle({ player, playerName });

  const startWithLog = (enemy: Monster, hpOverride?: number) => {
    onBattleStart?.(enemy.name);
    start(enemy, hpOverride);
  };

  // 플레이어 턴 자동 행동 결정 (자동포션 룰 평가 포함).
  const pickActionRef = useRef(pickAutoAction);
  const consumePotionRef = useRef(consumePotion);
  useEffect(() => {
    pickActionRef.current = pickAutoAction;
    consumePotionRef.current = consumePotion;
  });

  useEffect(() => {
    if (!state || state.phase !== "player") return;
    const id = setTimeout(() => {
      const picked = pickActionRef.current(state);
      let action: PlayerAction = picked;
      if (picked.kind === "use_potion") {
        if (!consumePotionRef.current(picked.potionId)) {
          action = { kind: "attack" };
        }
      }
      act(action);
    }, PLAYER_TURN_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [state, act]);

  // 종료 후 onConfirm — 외부 상태 반영 + 승리 시 다음 적 자동 체이닝.
  // ref로 보관해서 useEffect에서 latest 값 사용 (closure stale 방지).
  const handleConfirmRef = useRef(() => {});
  useEffect(() => {
    handleConfirmRef.current = () => {
      if (!state || !state.outcome) return;
      const isWin = state.outcome === "win";
      const finalHp = isWin ? state.playerHp : 0;
      const rewards = isWin ? { exp: state.enemy.exp } : { exp: 0 };

      onBattleEnd({
        outcome: state.outcome,
        enemyName: state.enemy.name,
        finalPlayerHp: finalHp,
        rewards,
      });

      if (isWin) {
        const nextEnemy = pickEnemy(region);
        if (nextEnemy) {
          // 체인 시작 — setCharacterState 가 아직 propagate 안 됐으므로
          // finalHp 를 직접 주입해 다음 전투를 정확한 HP로 시작.
          startWithLog(nextEnemy, finalHp);
          return;
        }
      }
      stop();
    };
  });

  // 승리 시 결과 화면을 1.2s 보여준 뒤 자동 진행. 패배는 사용자 확인 대기.
  useEffect(() => {
    if (!state || state.phase !== "ended") return;
    if (state.outcome !== "win") return;
    const id = setTimeout(() => handleConfirmRef.current(), RESULT_AUTO_CONFIRM_MS);
    return () => clearTimeout(id);
  }, [state]);

  // 1) 전투 외 — 진입 화면
  if (!state) {
    const hasEnemies = region.enemies.length > 0;
    return (
      <div className="space-y-3">
        <Card padding="md">
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            현재 위치
          </div>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {region.name}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {region.description}
          </p>
        </Card>

        {hasEnemies ? (
          <>
            <EnemyEncounterSection region={region} />
            <button
              type="button"
              onClick={() => {
                const enemy = pickEnemy(region);
                if (enemy) startWithLog(enemy);
              }}
              disabled={player.hp <= 0}
              className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {player.hp <= 0 ? "회복 필요" : "전투 시작"}
            </button>
            <AutoPotionSection
              autoConfig={autoPotionConfig}
              inventory={inventoryState}
              onUpdateRule={onUpdateAutoPotionRule}
            />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/90 dark:text-zinc-400">
            이곳에는 전투할 적이 없습니다.
          </div>
        )}
      </div>
    );
  }

  // 2) 전투 중
  if (state.phase !== "ended") {
    return <BattleScene state={state} playerName={playerName} />;
  }

  // 3) 종료 — 결과 화면
  return (
    <BattleResult
      outcome={state.outcome!}
      exp={state.outcome === "win" ? state.enemy.exp : 0}
      onConfirm={() => handleConfirmRef.current()}
    />
  );
}
