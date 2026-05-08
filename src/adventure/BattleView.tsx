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
import { useBattle, computeBattleCooldown } from "./battle/useBattle";
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

export type BattleEndPayload = {
  outcome: BattleOutcome;
  enemyName: string;
  finalPlayerHp: number;
  rewards: { exp: number };
  potionsConsumed: Partial<Record<PotionId, number>>;
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
  pickAutoAction: (state: BattleState) => PlayerAction;
  inventoryState: InventoryState;
  autoPotionConfig: AutoPotionConfig;
  onUpdateAutoPotionRule: (
    index: number,
    patch: Partial<AutoPotionRule>,
  ) => void;
}) {
  const { state, potionsConsumed, start, stop } = useBattle({
    player,
    playerName,
    pickAction: pickAutoAction,
    potions: inventoryState.potions,
  });

  const startWithLog = (enemy: Monster, hpOverride?: number) => {
    onBattleStart?.(enemy.name);
    start(enemy, hpOverride);
  };

  // 전투 종료 시 onBattleEnd 발화. 승리는 즉시 보상 적용 + cooldown 후 다음 적 자동 진행.
  // 패배는 BattleResult 모달에서 사용자 확인을 받은 뒤에야 발화 — 시작 마을 강제 이동이
  // BattleView unmount를 유발하므로 모달이 사라지지 않게.
  const onBattleEndRef = useRef(onBattleEnd);
  onBattleEndRef.current = onBattleEnd;

  const firedForStateRef = useRef<BattleState | null>(null);
  useEffect(() => {
    if (!state || state.phase !== "ended" || !state.outcome) return;
    if (firedForStateRef.current === state) return;
    if (state.outcome !== "win") return; // 패배는 confirm 시 발화
    firedForStateRef.current = state;
    onBattleEndRef.current({
      outcome: state.outcome,
      enemyName: state.enemy.name,
      finalPlayerHp: state.playerHp,
      rewards: { exp: state.enemy.exp },
      potionsConsumed,
    });
  }, [state, potionsConsumed]);

  // 승리 시 로그 길이에 비례한 cooldown 후 다음 적 자동 시작.
  // ref로 latest region/state 캡처해 setTimeout 클로저 stale 방지.
  const region_ref = useRef(region);
  region_ref.current = region;
  useEffect(() => {
    if (!state || state.phase !== "ended" || state.outcome !== "win") return;
    const cooldown = computeBattleCooldown(state.log.length);
    const finalHp = state.playerHp;
    const id = setTimeout(() => {
      const nextEnemy = pickEnemy(region_ref.current);
      if (nextEnemy) {
        startWithLog(nextEnemy, finalHp);
      } else {
        stop();
      }
    }, cooldown);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 2) 진행 중 / 승리 cooldown — 같은 화면. final state(전체 로그 + final HP)을 그대로 보여준다.
  // 진짜 "ended && lose"일 때만 결과 모달이 위에 뜬다.
  const isLoss =
    state.phase === "ended" && state.outcome === "lose";
  return (
    <>
      <BattleScene state={state} playerName={playerName} />
      {isLoss && (
        <BattleResult
          outcome="lose"
          exp={0}
          onConfirm={() => {
            onBattleEndRef.current({
              outcome: "lose",
              enemyName: state.enemy.name,
              finalPlayerHp: 0,
              rewards: { exp: 0 },
              potionsConsumed,
            });
          }}
        />
      )}
    </>
  );
}
