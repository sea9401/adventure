"use client";

import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { Card } from "@/components/ui/Card";
import { BattleView } from "@/adventure/BattleView";
import { CoopBossCard } from "@/adventure/coop/CoopBossCard";
import { COOP_BOSSES } from "@/adventure/coop/data";
import { applyCoopReward } from "@/adventure/coop/applyReward";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { useGame } from "@/adventure/GameContext";
import { resolveBuffMultiplier } from "@/adventure/data/guildBuffs";
import { getQuestById } from "@/adventure/data/quests";

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
    quests,
  } = useGame();
  const bossAttemptBonus = resolveBuffMultiplier(
    guildBuffs,
    "boss_attempt_bonus",
  );

  const coopBossDef = COOP_BOSSES[currentRegion.id];
  if (coopBossDef) {
    // 진입 자격 게이트 — requiredFlag 가 설정돼 있고 아직 안 셋되었으면 잠금 카드만.
    if (coopBossDef.requiredFlag && !storyFlags.has(coopBossDef.requiredFlag)) {
      return (
        <div className="space-y-3">
          <SubViewHeader title="보스" onBack={back} />
          <Card padding="md">
            <div className="text-xs uppercase tracking-wider text-rose-500/70 dark:text-rose-400/70">
              협동 보스 — 잠금
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {coopBossDef.lockedMessage ?? "아직 진입 자격을 얻지 못했다."}
            </p>
          </Card>
        </div>
      );
    }
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
              addEquipment: inventory.addEquipment,
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
          onKill={(bossName) => {
            // 협동 보스 처치를 kill 카운터 의뢰(운봉의 거인 처치/정기/숙련도)에 반영.
            // 도감 kill 카운트도 같이 — 솔로 보스 onBattleEnd 와 일관성.
            adventureLog.addKill(bossName);
            const readyIds = quests.recordKill(bossName);
            for (const id of readyIds) {
              const q = getQuestById(id);
              if (q) {
                addNotification(
                  "quest_ready",
                  `의뢰 조건 달성 — ${q.title}: 길드에서 보상을 받을 수 있다.`,
                );
              }
            }
          }}
          onAttackResult={(bossName, ctx) => {
            const readyIds = quests.recordCoopAttack(bossName, ctx);
            for (const id of readyIds) {
              const q = getQuestById(id);
              if (q) {
                addNotification(
                  "quest_ready",
                  `의뢰 조건 달성 — ${q.title}: 길드에서 보상을 받을 수 있다.`,
                );
              }
            }
          }}
          onClaim={(bossName, tier) => {
            const readyIds = quests.recordCoopClaim(bossName, tier);
            for (const id of readyIds) {
              const q = getQuestById(id);
              if (q) {
                addNotification(
                  "quest_ready",
                  `의뢰 조건 달성 — ${q.title}: 길드에서 보상을 받을 수 있다.`,
                );
              }
            }
          }}
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
