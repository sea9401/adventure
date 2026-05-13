"use client";

import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { TownView } from "@/adventure/TownView";
import { renderTownNpcDialogue } from "@/adventure/town/dialogues/renderTownNpcDialogue";
import { useGame } from "@/adventure/GameContext";

export function TownSubView() {
  const {
    currentRegion,
    back,
    pendingTownNpcId,
    setPendingTownNpcId,
    crafting,
    inventory,
    adventureLog,
    characterStateHook,
    quests,
    storyFlags,
    completeQuest,
    addNotification,
  } = useGame();

  return (
    <div className="space-y-3">
      <SubViewHeader title={currentRegion.name} onBack={back} />
      <TownView
        region={currentRegion}
        initialNpcId={pendingTownNpcId ?? undefined}
        onInitialNpcConsumed={() => setPendingTownNpcId(null)}
        onTalkClose={(npcId, regionId) => {
          adventureLog.incrementNpcTalk(npcId);
          adventureLog.addTownNpcTalked(regionId, npcId);
        }}
        renderNpcDialogue={(npc, close) =>
          renderTownNpcDialogue(npc, close, {
            crafting,
            inventory,
            quests,
            completeQuest,
            storyFlags,
            addNotification,
            characterStateHook,
            adventureLog,
          })
        }
      />
    </div>
  );
}
