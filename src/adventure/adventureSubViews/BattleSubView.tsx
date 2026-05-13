"use client";

import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { BattleView } from "@/adventure/BattleView";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { useGame } from "@/adventure/GameContext";
import { resolveBuffMultiplier } from "@/adventure/data/guildBuffs";

export function BattleSubView() {
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
    guildBuffs,
  } = useGame();
  const bossAttemptBonus = resolveBuffMultiplier(
    guildBuffs,
    "boss_attempt_bonus",
  );

  return (
    <div className="space-y-3">
      {/* 뒤로 = 사냥 화면을 떠난다 → 사냥도 멈춘다. 재진입 시 "사냥 시작" 을 다시 눌러야
          전투가 이어진다 — "전투" 버튼 ↔ "뒤로가기" 연타로 쿨다운 없이 사냥하던 문제 차단.
          (다른 in-app 탭으로 갔다 돌아오는 경우는 setTab 경로라 사냥 유지 — 종전대로.) */}
      <SubViewHeader
        title="전투"
        onBack={() => {
          setHuntingActive(false);
          back();
        }}
      />
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
        bossAttemptBonus={bossAttemptBonus}
      />
    </div>
  );
}
