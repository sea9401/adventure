"use client";

import { useEffect, useRef, useState } from "react";
import type { Monster } from "../data/monsters";
import {
  advanceTurn,
  initialBattleState,
  type BattleState,
  type PlayerCombat,
} from "./engine";

const TURN_INTERVAL_MS = 500;

// 단일 전투의 턴 루프만 관리. 종료/보상 처리는 호출 측(BattleView)이 담당.
export function useBattle({
  player,
  playerName,
}: {
  player: PlayerCombat;
  playerName: string;
}) {
  const [state, setState] = useState<BattleState | null>(null);
  const playerRef = useRef(player);
  const playerNameRef = useRef(playerName);
  playerRef.current = player;
  playerNameRef.current = playerName;

  // 자동 턴 루프 — phase가 player/enemy일 때만 다음 턴 예약.
  useEffect(() => {
    if (!state) return;
    if (state.phase === "ended") return;
    const id = setTimeout(() => {
      setState((prev) => {
        if (!prev || prev.phase === "ended") return prev;
        return advanceTurn(prev, playerRef.current, playerNameRef.current);
      });
    }, TURN_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [state]);

  const start = (enemy: Monster) => {
    setState(initialBattleState(playerRef.current, enemy, playerNameRef.current));
  };

  const stop = () => setState(null);

  return { state, start, stop };
}
