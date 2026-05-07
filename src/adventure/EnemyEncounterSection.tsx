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
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-base text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
      >
        ?
      </div>
    );
  }
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
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

export function EnemyEncounterSection({ region }: { region: Region }) {
  if (region.enemies.length === 0) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        마주칠 수 있는 적
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {region.enemies.map((enemy) => (
          <li
            key={enemy}
            className="inline-flex items-center gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 py-2 pl-2 pr-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <EnemyAvatar name={enemy} />
            <span className="text-zinc-700 dark:text-zinc-300">{enemy}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
