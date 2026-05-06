"use client";

import { Panel } from "@/components/ui/Panel";
import { useGame } from "@/lib/game/store";
import { TOWNS, unlockConditionLabel, DEFAULT_TOWN_ID } from "./data/towns";
import { TownCard } from "./TownCard";

export function VillageMap() {
  const state = useGame();
  const currentId = state.currentTownId ?? DEFAULT_TOWN_ID;
  const unlocked = state.unlockedTownIds ?? [DEFAULT_TOWN_ID];
  const inCombat = !!state.dispatch;

  return (
    <Panel title="마을 지도">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TOWNS.map((town) => {
          const isUnlocked = unlocked.includes(town.id);
          const isCurrent = currentId === town.id;
          const disabled = !isUnlocked || inCombat || isCurrent;
          return (
            <TownCard
              key={town.id}
              town={town}
              isCurrent={isCurrent}
              isUnlocked={isUnlocked}
              unlockLabel={unlockConditionLabel(town)}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                state.setTown(town.id);
              }}
            />
          );
        })}
      </div>
      {inCombat && (
        <p className="text-[11px] text-fg-dim mt-2">전투 중에는 마을을 이동할 수 없습니다.</p>
      )}
    </Panel>
  );
}
