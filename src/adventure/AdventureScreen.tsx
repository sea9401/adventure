"use client";

import { Compass, Hammer, Skull, Sword, User } from "@phosphor-icons/react";
import { EntryCard } from "@/components/ui/EntryCard";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { CharacterMini } from "@/adventure/character/CharacterMini";
import { BattleView } from "@/adventure/BattleView";
import { CoopBossCard } from "@/adventure/coop/CoopBossCard";
import { COOP_BOSSES } from "@/adventure/coop/data";
import { applyCoopReward } from "@/adventure/coop/applyReward";
import { MapView } from "@/adventure/MapView";
import { TownView } from "@/adventure/TownView";
import { TrialView } from "@/adventure/TrialView";
import { BlacksmithDialogue } from "@/adventure/town/dialogues/BlacksmithDialogue";
import { TrainerDialogue } from "@/adventure/town/dialogues/TrainerDialogue";
import { SuzyDialogue } from "@/adventure/town/dialogues/SuzyDialogue";
import { KaiDialogue } from "@/adventure/town/dialogues/KaiDialogue";
import { StrangerDialogue } from "@/adventure/town/dialogues/StrangerDialogue";
import { RioDialogue } from "@/adventure/town/dialogues/RioDialogue";
import { NoraDialogue } from "@/adventure/town/dialogues/NoraDialogue";
import { BoroDialogue } from "@/adventure/town/dialogues/BoroDialogue";
import { MarinDialogue } from "@/adventure/town/dialogues/MarinDialogue";
import { WoodcutterJimmyDialogue } from "@/adventure/town/dialogues/WoodcutterJimmyDialogue";
import { BaekunDialogue } from "@/adventure/town/dialogues/BaekunDialogue";
import { ManwolDialogue } from "@/adventure/town/dialogues/ManwolDialogue";
import { DoyeonDialogue } from "@/adventure/town/dialogues/DoyeonDialogue";
import { SanhaDialogue } from "@/adventure/town/dialogues/SanhaDialogue";
import { PilgrimDialogue } from "@/adventure/town/dialogues/PilgrimDialogue";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { findEdgeRequirement } from "@/adventure/data/edge-requirement";
import { WORLD_MAP } from "@/adventure/data/world";
import { useGame } from "@/adventure/GameContext";

export function AdventureScreen() {
  const {
    character,
    currentRegion,
    subView,
    setSubView,
    back,
    pendingTownNpcId,
    setPendingTownNpcId,
    trialEdge,
    trialWinCount,
    startTrial,
    endTrial,
    recordTrialWin,
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
    trialUnlocks,
    huntingActive,
    setHuntingActive,
    playerCombat,
    playerStatus,
    handleBattleEnd,
    completeQuest,
    addNotification,
  } = useGame();

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
          {COOP_BOSSES[currentRegion.id] && (
            <EntryCard
              icon={
                <Skull size={28} weight="duotone" className="text-rose-500" />
              }
              title="보스"
              description="협동 보스에 도전합니다."
              onClick={() => setSubView("boss")}
            />
          )}
          {!COOP_BOSSES[currentRegion.id] && currentRegion.boss && (
            <EntryCard
              icon={
                <Skull size={28} weight="duotone" className="text-rose-500" />
              }
              title="보스"
              description="이 지역의 보스에 도전합니다."
              onClick={() => setSubView("boss")}
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
                  storyFlags={storyFlags}
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
            if (npc.id === "diola_stranger") {
              return (
                <StrangerDialogue
                  npc={npc}
                  onClose={close}
                  storyFlags={storyFlags}
                  quests={quests}
                />
              );
            }
            if (npc.id === "diola_kid") {
              return (
                <RioDialogue
                  npc={npc}
                  onClose={close}
                  quests={quests}
                  completeQuest={completeQuest}
                  inventory={inventory}
                  storyFlags={storyFlags}
                />
              );
            }
            if (npc.id === "diola_innkeeper") {
              return (
                <NoraDialogue
                  npc={npc}
                  onClose={close}
                  quests={quests}
                  completeQuest={completeQuest}
                  inventory={inventory}
                  storyFlags={storyFlags}
                />
              );
            }
            if (npc.id === "diola_merchant") {
              return (
                <BoroDialogue
                  npc={npc}
                  onClose={close}
                  quests={quests}
                  completeQuest={completeQuest}
                  inventory={inventory}
                  storyFlags={storyFlags}
                />
              );
            }
            if (npc.id === "diola_elder") {
              return (
                <MarinDialogue
                  npc={npc}
                  onClose={close}
                  quests={quests}
                  completeQuest={completeQuest}
                  inventory={inventory}
                  storyFlags={storyFlags}
                />
              );
            }
            if (npc.id === "unhyang_elder") {
              return <BaekunDialogue npc={npc} onClose={close} />;
            }
            if (npc.id === "unhyang_smith") {
              return (
                <ManwolDialogue
                  npc={npc}
                  onClose={close}
                  storyFlags={storyFlags}
                />
              );
            }
            if (npc.id === "unhyang_guide") {
              return (
                <DoyeonDialogue
                  npc={npc}
                  onClose={close}
                  quests={quests}
                  completeQuest={completeQuest}
                />
              );
            }
            if (npc.id === "unhyang_herbalist") {
              return (
                <SanhaDialogue
                  npc={npc}
                  onClose={close}
                  quests={quests}
                  completeQuest={completeQuest}
                  inventory={inventory}
                />
              );
            }
            if (npc.id === "unhyang_pilgrim") {
              return <PilgrimDialogue npc={npc} onClose={close} />;
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
          playerLevel={character.level}
          playerName={character.name}
          playerStatus={playerStatus}
          onBattleStart={adventureLog.markEncountered}
          onBattleEnd={handleBattleEnd}
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
          bossAttemptsToday={characterStateHook.getBossAttemptsToday(
            currentRegion.id,
          )}
          onConsumeBossAttempt={() =>
            characterStateHook.consumeBossAttempt(currentRegion.id)
          }
        />
      </div>
    );
  }

  if (subView === "boss" && COOP_BOSSES[currentRegion.id]) {
    return (
      <div className="space-y-3">
        <SubViewHeader title="보스" onBack={back} />
        <CoopBossCard
          regionId={currentRegion.id}
          playerName={character.name}
          onPlayerHpChange={characterStateHook.setHp}
          applyReward={(reward) =>
            applyCoopReward(reward, {
              addMaterial: inventory.addMaterial,
              learnRecipe: crafting.learnRecipe,
              knowsRecipe: crafting.knows,
              markTitleObtained: adventureLog.markTitleObtained,
            })
          }
          notify={(text) => addNotification("info", text)}
        />
      </div>
    );
  }

  // 솔로 보스 (region.boss 정의된 region) 의 보스 서브뷰 — BattleView 를 bossOnlyMode 로
  // 띄워 보스 카드 + 도전만 노출. 일반 사냥은 별도 "전투" 서브뷰에서.
  if (subView === "boss" && currentRegion.boss) {
    return (
      <div className="space-y-3">
        <SubViewHeader title="보스" onBack={back} />
        <BattleView
          region={currentRegion}
          player={playerCombat}
          playerLevel={character.level}
          playerName={character.name}
          playerStatus={playerStatus}
          onBattleStart={adventureLog.markEncountered}
          onBattleEnd={handleBattleEnd}
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
          bossAttemptsToday={characterStateHook.getBossAttemptsToday(
            currentRegion.id,
          )}
          onConsumeBossAttempt={() =>
            characterStateHook.consumeBossAttempt(currentRegion.id)
          }
          bossOnlyMode
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

  if (subView === "map" && trialEdge) {
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

  return null;
}
