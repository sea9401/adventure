"use client";

import { useEffect, useRef, useState } from "react";
import type { BattleState } from "./engine";
import { MONSTERS } from "../data/monsters";
import {
  formatRelative,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";
import { Card } from "@/components/ui/Card";
import type { Gender } from "@/adventure/profile/avatars";

export type BattlePlayerStatus = {
  gender: Gender;
  mp: number;
  maxMp: number;
  exp: number;
  maxExp: number;
};

const RECENT_KIND_COLOR: Record<NotificationKind, string> = {
  battle_win: "text-emerald-700 dark:text-emerald-400",
  battle_lose: "text-rose-700 dark:text-rose-400",
  training_done: "text-amber-700 dark:text-amber-400",
  quest_ready: "text-yellow-700 dark:text-yellow-400",
  quest_complete: "text-violet-700 dark:text-violet-400",
  milestone: "text-fuchsia-700 dark:text-fuchsia-400",
  expedition: "text-teal-700 dark:text-teal-400",
  loot: "text-lime-700 dark:text-lime-400",
  item: "text-blue-700 dark:text-blue-400",
  info: "text-zinc-600 dark:text-zinc-400",
};

const RECENT_NOTIFICATIONS_VISIBLE = 3;

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

// 데미지 받은 순간 짧게 빨간 링 + 흔들림. hpDelta 가 변할 때마다 트리거.
function useDamageFlash(hp: number): boolean {
  const [flashing, setFlashing] = useState(false);
  const lastHpRef = useRef(hp);
  useEffect(() => {
    if (hp < lastHpRef.current) {
      setFlashing(true);
      const id = setTimeout(() => setFlashing(false), 350);
      lastHpRef.current = hp;
      return () => clearTimeout(id);
    }
    lastHpRef.current = hp;
  }, [hp]);
  return flashing;
}

const FLASH_CLASS =
  "ring-2 ring-rose-500 ring-offset-1 ring-offset-white animate-pulse dark:ring-offset-zinc-950";

function EnemyAvatar({ name, hp }: { name: string; hp: number }) {
  const image = MONSTERS[name]?.image;
  const flash = useDamageFlash(hp);
  const ringClass = flash ? ` ${FLASH_CLASS}` : "";
  if (!image) {
    return (
      <div
        aria-hidden
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-base text-zinc-400 transition-all dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500${ringClass}`}
      >
        ?
      </div>
    );
  }
  return (
    <div
      className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 transition-all dark:border-zinc-700 dark:bg-zinc-800${ringClass}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}

function PlayerAvatar({
  gender,
  name,
  hp,
}: {
  gender: Gender;
  name: string;
  hp: number;
}) {
  const [errored, setErrored] = useState(false);
  const flash = useDamageFlash(hp);
  const ringClass = flash ? ` ${FLASH_CLASS}` : "";
  if (errored) {
    return (
      <div
        aria-hidden
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-base text-zinc-400 transition-all dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500${ringClass}`}
      >
        ?
      </div>
    );
  }
  return (
    <div
      className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 transition-all dark:border-zinc-700 dark:bg-zinc-800${ringClass}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/images/character/${gender}.webp`}
        alt={name}
        onError={() => setErrored(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export function BattleScene({
  state,
  playerName,
  playerStatus,
  recentNotifications,
}: {
  state: BattleState;
  playerName: string;
  playerStatus: BattlePlayerStatus;
  recentNotifications?: AppNotification[];
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log]);

  const recents = (recentNotifications ?? []).slice(
    0,
    RECENT_NOTIFICATIONS_VISIBLE,
  );

  return (
    <div className="space-y-3">
      <Card padding="md">
        <div className="flex items-center gap-3">
          <EnemyAvatar name={state.enemy.name} hp={state.enemyHp} />
          <div className="flex-1">
            <HpBar
              label={state.enemy.name}
              value={state.enemyHp}
              max={state.enemy.hp}
              color="bg-rose-500"
            />
          </div>
        </div>
        <div className="mt-3 flex items-start gap-3">
          <PlayerAvatar
            gender={playerStatus.gender}
            name={playerName}
            hp={state.playerHp}
          />
          <div className="flex-1 space-y-2">
            <HpBar
              label={playerName}
              value={state.playerHp}
              max={state.playerMaxHp}
              color="bg-emerald-500"
            />
            <HpBar
              label="MP"
              value={playerStatus.mp}
              max={playerStatus.maxMp}
              color="bg-sky-500"
            />
            <HpBar
              label="EXP"
              value={playerStatus.exp}
              max={playerStatus.maxExp}
              color="bg-amber-400"
            />
          </div>
        </div>
      </Card>

      <div
        ref={logRef}
        className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white/90 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/90"
      >
        {state.log.map((entry, i) => {
          if (entry.kind === "phase_trigger") {
            return (
              <div
                key={i}
                className="my-1 rounded border border-amber-400/60 bg-amber-100/70 px-2 py-1 text-amber-900 shadow-sm dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200"
              >
                <span className="mr-1">⚠</span>
                <span className="font-semibold">{entry.text}</span>
              </div>
            );
          }
          // 크리/강공격/연타 등 [라벨] 시작은 미세 강조 — 일반 공격과 구분.
          const hasLabel = entry.text.startsWith("[");
          return (
            <div
              key={i}
              className={
                entry.kind === "player_attack"
                  ? `text-emerald-700 dark:text-emerald-400${hasLabel ? " font-semibold" : ""}`
                  : entry.kind === "enemy_attack"
                    ? `text-rose-700 dark:text-rose-400${hasLabel ? " font-semibold" : ""}`
                    : "text-zinc-600 dark:text-zinc-400"
              }
            >
              {entry.text}
            </div>
          );
        })}
      </div>

      {recents.length > 0 && (
        <Card padding="md">
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            최근 활동
          </div>
          <ul className="space-y-1">
            {recents.map((n) => (
              <li
                key={n.id}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span className={`truncate ${RECENT_KIND_COLOR[n.kind]}`}>
                  {n.text}
                </span>
                <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                  {formatRelative(n.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
