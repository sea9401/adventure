"use client";

import { useCallback, useRef, useState } from "react";
import type { Monster } from "../data/monsters";
import type { PotionId } from "../data/potions";
import {
  resolveBattle,
  type BattleResolution,
  type BattleState,
  type PlayerAction,
  type PlayerCombat,
} from "./engine";

// 한 전투의 lifecycle. start(enemy)를 호출하면 즉시 끝까지 시뮬되어 final state로 들어간다.
// 화면 표현은 BattleScene이 final state(전체 로그 + final HP)을 한 번에 그린다.
// cooldown/다음 적 체이닝은 BattleView가 처리.
export function useBattle({
  player,
  playerName,
  pickAction,
  potions,
}: {
  player: PlayerCombat;
  playerName: string;
  pickAction: (state: BattleState) => PlayerAction;
  potions: Partial<Record<PotionId, number>>;
}) {
  const [state, setState] = useState<BattleState | null>(null);
  const [potionsConsumed, setPotionsConsumed] = useState<
    Partial<Record<PotionId, number>>
  >({});

  // 매 렌더 latest 값을 ref로 캡처 — start 콜백이 stale closure에 갇히지 않도록.
  const playerRef = useRef(player);
  const playerNameRef = useRef(playerName);
  const pickActionRef = useRef(pickAction);
  const potionsRef = useRef(potions);
  playerRef.current = player;
  playerNameRef.current = playerName;
  pickActionRef.current = pickAction;
  potionsRef.current = potions;

  // hpOverride — 직전 전투의 finalHp를 그대로 이어받을 때 사용 (setCharacterState 비동기 우회).
  const start = useCallback((enemy: Monster, hpOverride?: number) => {
    const base = playerRef.current;
    const p = hpOverride !== undefined ? { ...base, hp: hpOverride } : base;
    const r: BattleResolution = resolveBattle(p, enemy, playerNameRef.current, {
      pickAction: pickActionRef.current,
      potions: potionsRef.current,
    });
    setState(r.finalState);
    setPotionsConsumed(r.potionsConsumed);
  }, []);

  const stop = useCallback(() => {
    setState(null);
    setPotionsConsumed({});
  }, []);

  return { state, potionsConsumed, start, stop };
}

// 한 줄(턴 메시지)당 누적되는 cooldown. 짧은 전투는 빠른 회전, 긴 전투는 사용자가 읽을 시간 확보.
export const COOLDOWN_PER_LOG_LINE_MS = 250;
export const MIN_BATTLE_COOLDOWN_MS = 600;
export const MAX_BATTLE_COOLDOWN_MS = 4000;

export function computeBattleCooldown(logLines: number): number {
  const raw = logLines * COOLDOWN_PER_LOG_LINE_MS;
  return Math.max(MIN_BATTLE_COOLDOWN_MS, Math.min(MAX_BATTLE_COOLDOWN_MS, raw));
}

// 오프라인 시뮬에서도 같은 PER_LINE을 쓰면 timing이 일치 — 호환성 유지용 alias.
export const PLAYER_TURN_INTERVAL_MS = COOLDOWN_PER_LOG_LINE_MS;
