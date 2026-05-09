"use client";

import { useEffect, useRef, useState } from "react";
import { MONSTERS, SPAR_DUMMY_ID, type Monster } from "./data/monsters";
import { useBattle } from "./battle/useBattle";
import {
  type BattleState,
  type PlayerAction,
  type PlayerCombat,
} from "./battle/engine";
import { BattleScene, type BattlePlayerStatus } from "./battle/BattleScene";
import type { InventoryState } from "./inventory/useInventory";
import type { AppNotification } from "@/lib/notifications";
import { Card } from "@/components/ui/Card";

// 스파링 — 훈련용 더미와의 모의전.
// - 보상/패널티/드롭/EXP/킬 카운터 전부 적용 안 됨 (onBattleEnd 가 호출되지 않음).
// - 캐릭터 HP/MP 는 시작 시점 그대로 유지 — useBattle 결과를 외부 state 로 전파하지 않음.
//   (시작 시 자동회복 X — 치료소 대용 악용 방지.)
// - 패배해도 복귀 마을 이동 없음. 모달 닫으면 끝.
export function SparringView({
  player,
  playerName,
  playerStatus,
  pickAutoAction,
  inventoryState,
  recentNotifications,
  onClose,
}: {
  player: PlayerCombat;
  playerName: string;
  playerStatus: BattlePlayerStatus;
  pickAutoAction: (state: BattleState) => PlayerAction;
  inventoryState: InventoryState;
  recentNotifications?: AppNotification[];
  onClose: () => void;
}) {
  const dummy: Monster | undefined = MONSTERS[SPAR_DUMMY_ID];

  const { state, start, stop } = useBattle({
    player,
    playerName,
    pickAction: pickAutoAction,
    potions: inventoryState.potions,
  });

  const startedRef = useRef(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (startedRef.current || !dummy) return;
    startedRef.current = true;
    start(dummy);
  }, [dummy, start]);

  if (!dummy) {
    return (
      <Card padding="md">
        <p className="text-sm text-rose-600 dark:text-rose-400">
          스파링용 더미가 정의되지 않았습니다.
        </p>
      </Card>
    );
  }

  const ended = state?.phase === "ended" && !!state.outcome;
  const isWin = ended && state.outcome === "win";

  const startNext = () => {
    stop();
    startedRef.current = true;
    setRound((r) => r + 1);
    start(dummy);
  };

  return (
    <div className="space-y-3">
      <Card padding="md">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {dummy.name}
          </h3>
          <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            라운드 {round + 1}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          모의전 — 보상도 손실도 없는 연습용 대결.
        </p>
      </Card>

      {state && (
        <BattleScene
          state={state}
          playerName={playerName}
          playerStatus={playerStatus}
          recentNotifications={recentNotifications}
        />
      )}

      {ended && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <Card padding="lg" className="w-full max-w-sm text-center">
            <div
              className={`text-2xl font-semibold ${
                isWin
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {isWin ? "스파링 성공" : "스파링 종료"}
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {isWin
                ? "더미를 깔끔하게 처리했다."
                : "한 번 더 부딪혀 봐도 좋다."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                훈련장으로
              </button>
              <button
                type="button"
                onClick={startNext}
                className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                한 번 더
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
