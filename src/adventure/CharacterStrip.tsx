"use client";

import { CLASSES } from "@/lib/game/data";
import { computeStats, getMonumentBonus } from "@/lib/game/logic";
import { useGame } from "@/lib/game/store";

export function CharacterStrip() {
  const state = useGame();
  const cls = CLASSES[state.character.currentClass];
  const monBonus = getMonumentBonus(state.estate.monument, state.stats.bossKillCounts);
  const stats = computeStats(state.character, monBonus);
  const hpPct = Math.max(0, Math.min(1, state.character.currentHp / stats.maxHp));

  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 flex items-center gap-3 text-xs">
      <div className="flex items-baseline gap-1.5 shrink-0">
        <span className="font-medium text-fg-strong text-sm">{state.character.name}</span>
        <span className="text-fg-faint">{cls.name}</span>
        <span className="text-fg-dim">Lv.{state.character.level}</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 h-1 bg-panel-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${hpPct * 100}%` }}
          />
        </div>
        <span className="text-fg-faint shrink-0 tabular-nums">
          {Math.floor(state.character.currentHp)}/{Math.floor(stats.maxHp)}
        </span>
      </div>
      <div className="text-fg-dim shrink-0 tabular-nums">
        💰{Math.floor(state.resources.gold).toLocaleString()}
      </div>
    </div>
  );
}
