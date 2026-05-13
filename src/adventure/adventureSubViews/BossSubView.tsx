"use client";

import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { BattleView } from "@/adventure/BattleView";
import { CoopBossCard } from "@/adventure/coop/CoopBossCard";
import { COOP_BOSSES } from "@/adventure/coop/data";
import { applyCoopReward } from "@/adventure/coop/applyReward";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { useGame } from "@/adventure/GameContext";
import { resolveBuffMultiplier } from "@/adventure/data/guildBuffs";

export function BossSubView() {
  const {
    character,
    currentRegion,
    back,
    adventureLog,
    characterStateHook,
    notifications,
    autoPotion,
    huntingActive,
    setHuntingActive,
    autoHunt,
    playerCombat,
    playerStatus,
    handleBattleEnd,
    inventory,
    crafting,
    storyFlags,
    addNotification,
    grantTitle,
    guildBuffs,
  } = useGame();
  const bossAttemptBonus = resolveBuffMultiplier(
    guildBuffs,
    "boss_attempt_bonus",
  );

  if (COOP_BOSSES[currentRegion.id]) {
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
          notifyBattle={(kind, text, log) =>
            addNotification(kind, text, { battleLog: log })
          }
          onStopHunting={() => setHuntingActive(false)}
          dispatched={autoHunt.isDispatched}
          onStoryFlag={storyFlags.set}
        />
      </div>
    );
  }

  // 솔로 보스 (region.boss 정의된 region) 의 보스 서브뷰 — BattleView 를 bossOnlyMode 로
  // 띄워 보스 카드 + 도전만 노출. 일반 사냥은 별도 "전투" 서브뷰에서.
  if (currentRegion.boss) {
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
          autoHunt={autoHunt}
          bossAttemptsToday={characterStateHook.getBossAttemptsToday(
            currentRegion.id,
          )}
          onConsumeBossAttempt={() =>
            characterStateHook.consumeBossAttempt(currentRegion.id)
          }
          onBossAttempt={() => {
            const slots = characterStateHook.equippedSlots;
            if (!slots.weapon && !slots.armor && !slots.accessory) {
              grantTitle("stagnant");
            }
          }}
          bossAttemptBonus={bossAttemptBonus}
          bossOnlyMode
        />
      </div>
    );
  }

  return null;
}
