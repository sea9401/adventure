"use client";

import { useEffect, useRef } from "react";
import type { BattleState } from "./engine";
import { MONSTERS } from "../data/monsters";

function HpBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 shrink-0 truncate text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
        {value}/{max}
      </span>
    </div>
  );
}

function EnemyAvatar({ name }: { name: string }) {
  const image = MONSTERS[name]?.image;
  if (!image) {
    return (
      <div
        aria-hidden
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-base text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
      >
        ?
      </div>
    );
  }
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

export function BattleScene({
  state,
  playerName,
}: {
  state: BattleState;
  playerName: string;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-200 bg-white/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="flex items-center gap-3">
          <EnemyAvatar name={state.enemy.name} />
          <div className="flex-1">
            <HpBar
              label={state.enemy.name}
              value={state.enemyHp}
              max={state.enemy.hp}
              color="bg-rose-500"
            />
          </div>
        </div>
        <div className="mt-3">
          <HpBar
            label={playerName}
            value={state.playerHp}
            max={state.playerMaxHp}
            color="bg-emerald-500"
          />
        </div>
      </div>

      <div
        ref={logRef}
        className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white/40 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/40"
      >
        {state.log.map((entry, i) => (
          <div
            key={i}
            className={
              entry.kind === "player_attack"
                ? "text-emerald-700 dark:text-emerald-400"
                : entry.kind === "enemy_attack"
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-zinc-600 dark:text-zinc-400"
            }
          >
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}
