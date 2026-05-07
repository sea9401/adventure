"use client";

import { useState } from "react";
import type { Region } from "./data/world";
import { MONSTERS } from "./data/monsters";

function EnemyAvatar({ name }: { name: string }) {
  const [errored, setErrored] = useState(false);
  const image = MONSTERS[name]?.image;
  if (!image || errored) {
    return (
      <div
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-zinc-200 bg-zinc-100 text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
      >
        ?
      </div>
    );
  }
  return (
    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-sm border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        onError={() => setErrored(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export function BattleView({ region }: { region: Region }) {
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
        <div className="rounded-lg border border-zinc-200 bg-white/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            마주칠 수 있는 적
          </div>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {region.enemies.map((enemy) => (
              <li
                key={enemy}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 py-1 pl-1 pr-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <EnemyAvatar name={enemy} />
                <span className="text-zinc-700 dark:text-zinc-300">{enemy}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled
            className="mt-3 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            전투 시작 (준비 중)
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white/40 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
          이곳에는 전투할 적이 없습니다.
        </div>
      )}
    </div>
  );
}
