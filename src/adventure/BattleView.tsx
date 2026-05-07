"use client";

import { useEffect, useRef } from "react";
import type { Region } from "./data/world";
import { MONSTERS, type Monster } from "./data/monsters";
import type { BattleOutcome, PlayerCombat } from "./battle/engine";
import { useBattle } from "./battle/useBattle";
import { BattleScene } from "./battle/BattleScene";
import { BattleResult } from "./battle/BattleResult";
import { EnemyEncounterSection } from "./EnemyEncounterSection";

const RESULT_AUTO_CONFIRM_MS = 1200;

export type BattleEndPayload = {
  outcome: BattleOutcome;
  finalPlayerHp: number;
  rewards: { exp: number; gold: number };
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
  autoBattle,
  onAutoBattleChange,
  onBattleEnd,
}: {
  region: Region;
  player: PlayerCombat;
  playerName: string;
  autoBattle: boolean;
  onAutoBattleChange: (next: boolean) => void;
  onBattleEnd: (payload: BattleEndPayload) => void;
}) {
  const { state, start, stop } = useBattle({ player, playerName });

  // 종료 후 onConfirm — 외부 상태 반영 + 자동/수동 다음 행동 분기.
  // ref로 보관해서 useEffect에서 latest 값 사용 (closure stale 방지).
  const handleConfirmRef = useRef(() => {});
  handleConfirmRef.current = () => {
    if (!state || !state.outcome) return;
    const isWin = state.outcome === "win";
    const finalHp = isWin ? state.playerHp : 0;
    const rewards = isWin
      ? { exp: state.enemy.exp, gold: state.enemy.gold }
      : { exp: 0, gold: 0 };

    onBattleEnd({ outcome: state.outcome, finalPlayerHp: finalHp, rewards });

    if (isWin && autoBattle) {
      const nextEnemy = pickEnemy(region);
      if (nextEnemy) {
        start(nextEnemy);
        return;
      }
    }
    stop();
  };

  // 자동 확인 타이머 — autoBattle ON & ended일 때만 1.2s 후 자동 진행.
  useEffect(() => {
    if (!state || state.phase !== "ended") return;
    if (!autoBattle) return;
    const id = setTimeout(() => handleConfirmRef.current(), RESULT_AUTO_CONFIRM_MS);
    return () => clearTimeout(id);
  }, [state, autoBattle]);

  // 1) 전투 외 — 진입 화면
  if (!state) {
    const hasEnemies = region.enemies.length > 0;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-zinc-200 bg-white/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            현재 위치
          </div>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {region.name}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {region.description}
          </p>
        </div>

        {hasEnemies ? (
          <>
            <EnemyEncounterSection region={region} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAutoBattleChange(!autoBattle)}
                aria-pressed={autoBattle}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-medium transition-colors ${
                  autoBattle
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                    : "border-zinc-300 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-block h-2 w-2 rounded-full ${
                    autoBattle ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
                  }`}
                />
                자동 전투 {autoBattle ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const enemy = pickEnemy(region);
                  if (enemy) start(enemy);
                }}
                disabled={player.hp <= 0}
                className="flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {player.hp <= 0 ? "회복 필요" : "전투 시작"}
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white/40 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
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
      gold={state.outcome === "win" ? state.enemy.gold : 0}
      onConfirm={() => handleConfirmRef.current()}
      autoConfirm={state.outcome === "win" && autoBattle}
    />
  );
}
