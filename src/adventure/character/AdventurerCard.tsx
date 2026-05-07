import { Coins } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { Character } from "./types";

export function AdventurerCard({ character }: { character: Character }) {
  const items: { label: string; value: ReactNode }[] = [
    { label: "소속", value: character.affiliation },
    { label: "전투 전적", value: `${character.battleCount.toLocaleString()}회` },
    { label: "명성", value: character.fame.toLocaleString() },
    {
      label: "보유 골드",
      value: (
        <span className="inline-flex items-center gap-1">
          <Coins size={14} weight="fill" className="text-yellow-500" />
          {character.gold.toLocaleString()}
        </span>
      ),
    },
  ];
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        모험가 카드
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {items.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {label}
            </div>
            <div className="mt-0.5 text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
