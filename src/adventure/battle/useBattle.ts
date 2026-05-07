"use client";

import { useEffect, useRef, useState } from "react";
import type { Monster } from "../data/monsters";
import {
  advanceTurn,
  initialBattleState,
  type BattleState,
  type PlayerAction,
  type PlayerCombat,
} from "./engine";

const TURN_INTERVAL_MS = 500;

// 단일 전투의 turn loop 관리.
// - enemy phase는 자동으로 한 턴씩 진행 (TURN_INTERVAL_MS 간격).
// - player phase는 외부에서 `act(action)`을 호출해야 진행 — 자동/수동 모드 분기는 호출측 책임.
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

  useEffect(() => {
    playerRef.current = player;
    playerNameRef.current = playerName;
  });

  // 적 턴 자동 진행.
  useEffect(() => {
    if (!state) return;
    if (state.phase !== "enemy") return;
    const id = setTimeout(() => {
      setState((prev) => {
        if (!prev || prev.phase !== "enemy") return prev;
        return advanceTurn(prev, playerRef.current, playerNameRef.current);
      });
    }, TURN_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [state]);

  // hpOverride — 자동 전투 체인처럼 직전 전투의 finalHp를 그대로 이어받아 시작할 때 사용.
  // setCharacterState 가 비동기라 playerRef.current.hp 가 stale일 수 있으므로 명시 주입.
  const start = (enemy: Monster, hpOverride?: number) => {
    const base = playerRef.current;
    const p =
      hpOverride !== undefined ? { ...base, hp: hpOverride } : base;
    setState(initialBattleState(p, enemy, playerNameRef.current));
  };

  const stop = () => setState(null);

  // 플레이어 행동 적용 — phase가 player일 때만 진행.
  const act = (action: PlayerAction) => {
    setState((prev) => {
      if (!prev || prev.phase !== "player") return prev;
      return advanceTurn(prev, playerRef.current, playerNameRef.current, action);
    });
  };

  return { state, start, stop, act };
}

export const PLAYER_TURN_INTERVAL_MS = TURN_INTERVAL_MS;
