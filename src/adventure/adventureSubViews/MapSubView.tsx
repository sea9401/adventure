"use client";

import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { MapView } from "@/adventure/MapView";
import { TrialView } from "@/adventure/TrialView";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { findEdgeRequirement } from "@/adventure/data/edge-requirement";
import { WORLD_MAP } from "@/adventure/data/world";
import { useGame } from "@/adventure/GameContext";

export function MapSubView() {
  const {
    character,
    back,
    trialEdge,
    trialWinCount,
    startTrial,
    endTrial,
    recordTrialWin,
    mapProgress,
    setMapProgress,
    inventory,
    adventureLog,
    storyFlags,
    notifications,
    autoPotion,
    trialUnlocks,
    playerCombat,
    playerStatus,
    handleBattleEnd,
    addNotification,
  } = useGame();

  if (!trialEdge) {
    return (
      <div className="space-y-3">
        <SubViewHeader title="지도" onBack={back} />
        <MapView
          progress={mapProgress}
          onProgressChange={setMapProgress}
          log={adventureLog.log}
          playerHp={character.hp}
          isTrialCleared={trialUnlocks.isCleared}
          hasStoryFlag={storyFlags.has}
          onTrialStart={(from, to) => {
            const req = findEdgeRequirement(from, to);
            if (!req || req.kind !== "trial") return;
            startTrial({
              from,
              to,
              battles: req.battles,
              enemiesFrom: req.enemiesFrom,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SubViewHeader title="시련" onBack={endTrial} />
      <TrialView
        trial={trialEdge}
        player={playerCombat}
        playerLevel={character.level}
        playerName={character.name}
        playerStatus={playerStatus}
        pickAutoAction={(state) =>
          pickAutoAction(state, {
            rules: autoPotion.config.rules,
            potions: inventory.state.potions,
          })
        }
        inventoryState={inventory.state}
        onBattleEnd={handleBattleEnd}
        initialWinCount={trialWinCount}
        onWinUpdate={recordTrialWin}
        onTrialEnd={(result) => {
          if (result === "win" && trialEdge) {
            // 시련 통과 — enemiesFrom 지역을 영구 해금. 같은 enemiesFrom 을 요구하는
            // 모든 진입로(예: cave→lake / forest→lake) 가 한 번에 풀린다.
            trialUnlocks.markCleared(trialEdge.enemiesFrom);
            setMapProgress((prev) => ({
              ...prev,
              currentRegionId: trialEdge.to,
              visitedRegionIds: prev.visitedRegionIds.includes(trialEdge.to)
                ? prev.visitedRegionIds
                : [...prev.visitedRegionIds, trialEdge.to],
            }));
            addNotification(
              "info",
              `시련 통과 — ${
                WORLD_MAP.regions.find((r) => r.id === trialEdge.to)?.name ??
                trialEdge.to
              } 진입.`,
            );
          }
          endTrial();
        }}
        onAbort={endTrial}
        recentNotifications={notifications.list}
      />
    </div>
  );
}
