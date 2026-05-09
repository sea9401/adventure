"use client";

import { Compass, Hammer, Sword, User } from "@phosphor-icons/react";
import { EntryCard } from "@/components/ui/EntryCard";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { CharacterMini } from "@/adventure/character/CharacterMini";
import { BattleView, type BattleEndPayload } from "@/adventure/BattleView";
import { MapView } from "@/adventure/MapView";
import { TownView } from "@/adventure/TownView";
import { TrialView, type TrialEdge } from "@/adventure/TrialView";
import { BlacksmithDialogue } from "@/adventure/town/dialogues/BlacksmithDialogue";
import { TrainerDialogue } from "@/adventure/town/dialogues/TrainerDialogue";
import { SuzyDialogue } from "@/adventure/town/dialogues/SuzyDialogue";
import { KaiDialogue } from "@/adventure/town/dialogues/KaiDialogue";
import { WoodcutterJimmyDialogue } from "@/adventure/town/dialogues/WoodcutterJimmyDialogue";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { findEdgeRequirement } from "@/adventure/data/edge-requirement";
import { WORLD_MAP } from "@/adventure/data/world";
import type { Character } from "@/adventure/character/types";
import type { Region } from "@/adventure/data/world";
import type { MapProgress } from "@/lib/map-progress";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";
import type { useAdventureLog } from "@/adventure/log/useAdventureLog";
import type { useAutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";
import type { useCharacterState } from "@/adventure/character/useCharacterState";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useEdgeUnlocks } from "@/adventure/edges/useEdgeUnlocks";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useNotifications } from "@/adventure/notifications/useNotifications";
import type { useQuests } from "@/adventure/quests/useQuests";
import type { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";

type PlayerCombat = React.ComponentProps<typeof BattleView>["player"];
type PlayerStatus = React.ComponentProps<typeof BattleView>["playerStatus"];

type Props = {
  character: Character;
  currentRegion: Region;
  subView: string | null;
  setSubView: (next: string | null) => void;
  back: () => void;
  pendingTownNpcId: string | null;
  setPendingTownNpcId: (id: string | null) => void;
  trialEdge: TrialEdge | null;
  setTrialEdge: (edge: TrialEdge | null) => void;
  mapProgress: MapProgress;
  setMapProgress: React.Dispatch<React.SetStateAction<MapProgress>>;
  crafting: ReturnType<typeof useCrafting>;
  inventory: ReturnType<typeof useInventory>;
  adventureLog: ReturnType<typeof useAdventureLog>;
  characterStateHook: ReturnType<typeof useCharacterState>;
  quests: ReturnType<typeof useQuests>;
  storyFlags: ReturnType<typeof useStoryFlags>;
  notifications: ReturnType<typeof useNotifications>;
  autoPotion: ReturnType<typeof useAutoPotionConfig>;
  edgeUnlocks: ReturnType<typeof useEdgeUnlocks>;
  huntingActive: boolean;
  setHuntingActive: (next: boolean) => void;
  playerCombat: PlayerCombat;
  playerStatus: PlayerStatus;
  onBattleEnd: (payload: BattleEndPayload) => void;
  completeQuest: (id: string) => boolean;
  addNotification: (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => void;
};

export function AdventureScreen(props: Props) {
  const {
    character,
    currentRegion,
    subView,
    setSubView,
    back,
    pendingTownNpcId,
    setPendingTownNpcId,
    trialEdge,
    setTrialEdge,
    mapProgress,
    setMapProgress,
    crafting,
    inventory,
    adventureLog,
    characterStateHook,
    quests,
    storyFlags,
    notifications,
    autoPotion,
    edgeUnlocks,
    huntingActive,
    setHuntingActive,
    playerCombat,
    playerStatus,
    onBattleEnd,
    completeQuest,
    addNotification,
  } = props;

  if (subView === null) {
    return (
      <>
        <CharacterMini character={character} />
        {(() => {
          if (currentRegion.id !== "village") return null;
          if (crafting.state.boldQuestComplete) return null;
          const message = !crafting.knows("baseball_bat")
            ? "지나가던 당신을 대장장이가 부릅니다."
            : !crafting.hasCrafted("baseball_bat")
              ? "대장장이가 망치질을 멈추고 당신을 흘끗 본다."
              : "야구 방망이를 만든 당신을 대장장이가 다시 찾는다.";
          return (
            <button
              type="button"
              onClick={() => {
                setPendingTownNpcId("village_blacksmith_bold");
                setSubView("town");
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-amber-300/80 bg-amber-50/70 px-4 py-3 text-left transition-colors hover:bg-amber-100/70 dark:border-amber-900/60 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
            >
              <Hammer
                size={28}
                weight="duotone"
                className="shrink-0 text-amber-600 dark:text-amber-400"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-amber-700/80 dark:text-amber-400/80">
                  알림판
                </div>
                <p className="mt-0.5 text-sm italic text-zinc-700 dark:text-zinc-300">
                  {message}
                </p>
              </div>
            </button>
          );
        })()}
        <div className="space-y-2">
          {currentRegion.tags?.includes("town") && (
            <EntryCard
              icon={
                <User size={28} weight="duotone" className="text-blue-500" />
              }
              title={currentRegion.name}
              description="마을을 둘러보고 사람들과 이야기합니다."
              onClick={() => setSubView("town")}
            />
          )}
          {currentRegion.enemies.length > 0 && (
            <EntryCard
              icon={
                <Sword size={28} weight="duotone" className="text-rose-500" />
              }
              title="전투"
              description="적과 맞서 싸웁니다."
              onClick={() => setSubView("battle")}
            />
          )}
          <EntryCard
            icon={
              <Compass
                size={28}
                weight="duotone"
                className="text-emerald-500"
              />
            }
            title="지도"
            description="모험할 곳을 찾아봅니다."
            onClick={() => setSubView("map")}
          />
        </div>
      </>
    );
  }

  if (subView === "town") {
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
          renderNpcDialogue={(npc, close) => {
            if (npc.id === "village_blacksmith_bold") {
              return (
                <BlacksmithDialogue
                  npc={npc}
                  onClose={close}
                  crafting={crafting}
                  inventory={inventory}
                  addNotification={addNotification}
                />
              );
            }
            if (npc.id === "village_trainer_smith") {
              return (
                <TrainerDialogue
                  npc={npc}
                  onClose={close}
                  quests={quests}
                  completeQuest={completeQuest}
                />
              );
            }
            if (npc.id === "village_woodcutter_jimmy") {
              return (
                <WoodcutterJimmyDialogue
                  npc={npc}
                  onClose={close}
                  crafting={crafting}
                  quests={quests}
                  completeQuest={completeQuest}
                />
              );
            }
            if (npc.id === "village_suzy") {
              return (
                <SuzyDialogue
                  npc={npc}
                  onClose={close}
                  storyFlags={storyFlags}
                  inventory={inventory}
                  characterStateHook={characterStateHook}
                  addNotification={addNotification}
                />
              );
            }
            if (npc.id === "diola_fisher") {
              return (
                <KaiDialogue
                  npc={npc}
                  onClose={close}
                  storyFlags={storyFlags}
                />
              );
            }
            return null;
          }}
        />
      </div>
    );
  }

  if (subView === "battle") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="전투" onBack={back} />
        <BattleView
          region={currentRegion}
          player={playerCombat}
          playerName={character.name}
          playerStatus={playerStatus}
          onBattleStart={adventureLog.markEncountered}
          onBattleEnd={onBattleEnd}
          pickAutoAction={(state) =>
            pickAutoAction(state, {
              rules: autoPotion.config.rules,
              potions: inventory.state.potions,
            })
          }
          inventoryState={inventory.state}
          autoPotionConfig={autoPotion.config}
          onUpdateAutoPotionRule={autoPotion.updateRule}
          recentNotifications={notifications.list}
          huntingActive={huntingActive}
          onToggleHunting={setHuntingActive}
        />
      </div>
    );
  }

  if (subView === "map" && !trialEdge) {
    return (
      <div className="space-y-3">
        <SubViewHeader title="지도" onBack={back} />
        <MapView
          progress={mapProgress}
          onProgressChange={setMapProgress}
          log={adventureLog.log}
          playerHp={character.hp}
          isEdgeUnlocked={edgeUnlocks.isUnlocked}
          onTrialStart={(from, to) => {
            const req = findEdgeRequirement(from, to);
            if (!req || req.kind !== "trial") return;
            setTrialEdge({
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

  if (subView === "map" && trialEdge) {
    return (
      <div className="space-y-3">
        <SubViewHeader title="시련" onBack={() => setTrialEdge(null)} />
        <TrialView
          trial={trialEdge}
          player={playerCombat}
          playerName={character.name}
          playerStatus={playerStatus}
          pickAutoAction={(state) =>
            pickAutoAction(state, {
              rules: autoPotion.config.rules,
              potions: inventory.state.potions,
            })
          }
          inventoryState={inventory.state}
          onBattleEnd={onBattleEnd}
          onTrialEnd={(result) => {
            if (result === "win" && trialEdge) {
              edgeUnlocks.unlock(trialEdge.from, trialEdge.to);
              setMapProgress((prev) => ({
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
            setTrialEdge(null);
          }}
          onAbort={() => setTrialEdge(null)}
          recentNotifications={notifications.list}
        />
      </div>
    );
  }

  return null;
}
