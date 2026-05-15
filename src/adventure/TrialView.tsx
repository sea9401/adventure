"use client";

import { useEffect, useRef, useState } from "react";
import { WORLD_MAP, pickEnemyName, type RegionId } from "./data/world";
import { MONSTERS, type Monster } from "./data/monsters";
import {
  useBattle,
  computeBattleCooldown,
} from "./battle/useBattle";
import {
  type BattleState,
  type PlayerAction,
  type PlayerCombat,
} from "./battle/engine";
import { BattleScene, type BattlePlayerStatus } from "./battle/BattleScene";
import { BattleResult } from "./battle/BattleResult";
import { Card } from "@/components/ui/Card";
import type { InventoryState } from "./inventory/useInventory";
import type { AppNotification } from "@/lib/notifications";
import type { BattleEndPayload } from "./BattleView";
import { applyNewbieBonus } from "@/lib/leveling";

function pickEnemyFor(regionId: RegionId): Monster | null {
  const region = WORLD_MAP.regions.find((r) => r.id === regionId);
  if (!region) return null;
  const name = pickEnemyName(region);
  return name ? (MONSTERS[name] ?? null) : null;
}

export type TrialEdge = {
  from: RegionId;
  to: RegionId;
  battles: number;
  enemiesFrom: RegionId;
};

export function TrialView({
  trial,
  player,
  playerLevel,
  playerName,
  playerStatus,
  pickAutoAction,
  inventoryState,
  onBattleEnd,
  onTrialEnd,
  onAbort,
  recentNotifications,
  initialWinCount = 0,
  onWinUpdate,
}: {
  trial: TrialEdge;
  player: PlayerCombat;
  /** 신참 EXP ×2 보너스 판정용. */
  playerLevel: number;
  playerName: string;
  playerStatus: BattlePlayerStatus;
  pickAutoAction: (state: BattleState) => PlayerAction;
  inventoryState: InventoryState;
  /** 매 전투 종료마다 호출. 외부에서 EXP/킬/드롭/패배 후처리 적용. */
  onBattleEnd: (payload: BattleEndPayload) => void;
  /** 시련 종료 — "win" 이면 5승 완료, "lose" 면 도중 패배 또는 사용자 포기. */
  onTrialEnd: (result: "win" | "lose") => void;
  /** 사용자가 시련을 포기하고 지도로 돌아가고 싶을 때. */
  onAbort: () => void;
  recentNotifications?: AppNotification[];
  /** 저장된 진행도부터 이어 시작. reload/백그라운드 복귀 후 시련 재개용. */
  initialWinCount?: number;
  /** 한 전투 승리할 때마다 부모에 알림 — 부모가 영구 저장을 갱신. */
  onWinUpdate?: (winCount: number) => void;
}) {
  const targetRegion = WORLD_MAP.regions.find(
    (r) => r.id === trial.enemiesFrom,
  );
  const targetName = targetRegion?.name ?? "?";

  const { state, potionsConsumed, start, stop } = useBattle({
    player,
    playerName,
    pickAction: pickAutoAction,
    potions: inventoryState.potions,
  });

  // 누적 승수. initialWinCount 로 시드 → reload 후 이어서 진행 가능.
  // 컴포넌트 마운트 시 한 번만 적용 (이후 prop 변경은 무시).
  const winCountRef = useRef(initialWinCount);
  const [winCount, setWinCount] = useState(initialWinCount);

  // 마운트 시 첫 전투 시작 — 단, initialWinCount 가 이미 임계 이상이면 새 전투 X
  // 곧장 완료 분기로. 800ms 완료 타이머 발화 전 hidden→reload 가 끼면 다음 mount 에서
  // 새 전투를 또 시작해 winCount 가 battles 를 넘어 누적되던 결함의 복구 경로.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (winCountRef.current >= trial.battles) {
      onTrialEndRef.current("win");
      return;
    }
    const enemy = pickEnemyFor(trial.enemiesFrom);
    if (enemy) start(enemy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 전투 종료 처리. 같은 state 객체에 대해 한 번만 발화.
  const onBattleEndRef = useRef(onBattleEnd);
  const onTrialEndRef = useRef(onTrialEnd);
  useEffect(() => {
    onBattleEndRef.current = onBattleEnd;
    onTrialEndRef.current = onTrialEnd;
  });
  const firedForStateRef = useRef<BattleState | null>(null);

  useEffect(() => {
    if (!state || state.phase !== "ended" || !state.outcome) return;
    if (firedForStateRef.current === state) return;
    if (state.outcome !== "win") return; // 패배는 모달 confirm 시 처리
    firedForStateRef.current = state;
    const expBonus = applyNewbieBonus(state.enemy.exp, playerLevel);
    // 외부에 승리 후처리 (EXP/kill/drop/notif).
    onBattleEndRef.current({
      outcome: "win",
      enemyName: state.enemy.name,
      finalPlayerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
      rewards: { exp: expBonus.gained, expBonusApplied: expBonus.bonusApplied },
      potionsConsumed,
      log: state.log,
    });
    winCountRef.current += 1;
    setWinCount(winCountRef.current);
    onWinUpdate?.(winCountRef.current);
  }, [state, potionsConsumed, playerLevel, onWinUpdate]);

  // 승리 카운트가 임계 도달 → 시련 완료. 아니면 cooldown 후 다음 적.
  useEffect(() => {
    if (!state || state.phase !== "ended" || state.outcome !== "win") return;
    if (winCountRef.current >= trial.battles) {
      // 결과 cooldown 후 unlock + move.
      const id = setTimeout(() => onTrialEndRef.current("win"), 800);
      return () => clearTimeout(id);
    }
    const cooldown = computeBattleCooldown(state.turn.completedPlayerTurns);
    const finalHp = state.playerHp;
    const id = setTimeout(() => {
      const next = pickEnemyFor(trial.enemiesFrom);
      if (next) start(next, finalHp);
    }, cooldown);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state) {
    // 첫 적 픽이 실패한 경우 (이론적으로 enemiesFrom 지역에 적이 없을 때) 안내.
    return (
      <div className="space-y-3">
        <Card padding="md">
          <h3 className="text-base font-semibold">시련 시작 실패</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {targetName}에 적이 정의되지 않아 시련을 진행할 수 없습니다.
          </p>
          <button
            type="button"
            onClick={onAbort}
            className="mt-3 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            지도로 돌아가기
          </button>
        </Card>
      </div>
    );
  }

  const isLoss = state.phase === "ended" && state.outcome === "lose";
  const completed = winCount >= trial.battles;

  return (
    <div className="space-y-3">
      <Card padding="md">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {targetName} 시련
          </h3>
          <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            진행 {Math.min(winCount, trial.battles)} / {trial.battles}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {trial.battles}전 연승해야 통과 — 도중 패배 시 시작 마을로 강제 귀환.
        </p>
      </Card>

      <BattleScene
        state={state}
        playerName={playerName}
        playerStatus={playerStatus}
        recentNotifications={recentNotifications}
      />

      {isLoss && (
        <BattleResult
          outcome="lose"
          exp={0}
          onConfirm={() => {
            if (firedForStateRef.current === state) return;
            firedForStateRef.current = state;
            onBattleEndRef.current({
              outcome: "lose",
              enemyName: state.enemy.name,
              finalPlayerHp: 0,
              playerMaxHp: state.playerMaxHp,
              rewards: { exp: 0, expBonusApplied: false },
              potionsConsumed,
              log: state.log,
            });
            stop();
            onTrialEndRef.current("lose");
          }}
        />
      )}

      {completed && !isLoss && (
        <Card padding="md" className="text-center">
          <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
            시련 통과 — {targetName} 으로 향한다.
          </div>
        </Card>
      )}
    </div>
  );
}
