"use client";

import { useEffect, useRef } from "react";
import type { BattleState } from "./engine";
import { MONSTERS } from "../data/monsters";
import { POTIONS, type PotionId } from "../data/potions";
import { Card } from "@/components/ui/Card";

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
      <img src={image} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}

export type ManualAction = {
  potionCounts: Partial<Record<PotionId, number>>;
  onAttack: () => void;
  onUsePotion: (id: PotionId) => void;
};

export function BattleScene({
  state,
  playerName,
  manual,
}: {
  state: BattleState;
  playerName: string;
  manual?: ManualAction;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log]);

  const showActions = manual && state.phase === "player";

  return (
    <div className="space-y-3">
      <Card padding="md">
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
      </Card>

      <div
        ref={logRef}
        className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white/90 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/90"
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

      {showActions && <ManualActionBar manual={manual} state={state} />}
    </div>
  );
}

function ManualActionBar({
  manual,
  state,
}: {
  manual: ManualAction;
  state: BattleState;
}) {
  const atFullHp = state.playerHp >= state.playerMaxHp;
  const potionEntries = (Object.keys(manual.potionCounts) as PotionId[])
    .map((id) => ({ id, potion: POTIONS[id], count: manual.potionCounts[id] ?? 0 }))
    .filter((e) => e.potion);

  return (
    <Card>
      <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        행동 선택
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={manual.onAttack}
          className="flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          공격
        </button>
        {potionEntries.map(({ id, potion, count }) => {
          const disabled = count <= 0 || atFullHp;
          return (
            <button
              key={id}
              type="button"
              onClick={() => manual.onUsePotion(id)}
              disabled={disabled}
              title={
                atFullHp ? "HP가 가득 차서 사용할 수 없습니다" : undefined
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-400 dark:text-emerald-300"
            >
              {potion.name}
              <span className="tabular-nums text-xs text-emerald-600 dark:text-emerald-400">
                ×{count}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
