"use client";

import {
  Backpack,
  BookOpen,
  ClipboardText,
  Crown,
  Scroll,
  Sparkle,
  User,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EntryCard } from "@/components/ui/EntryCard";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { AdventurerCard } from "@/adventure/character/AdventurerCard";
import { CharacterMini } from "@/adventure/character/CharacterMini";
import { SkillsView } from "@/adventure/character/SkillsView";
import { StatsPanel } from "@/adventure/character/StatsPanel";
import { AdventureLogView } from "@/adventure/log/AdventureLogView";
import { InventoryView } from "@/adventure/InventoryView";
import { RecentLogView } from "@/adventure/RecentLogView";
import { QuestJournalView } from "@/adventure/quests/QuestJournalView";
import { TowerSubView } from "@/adventure/adventureSubViews/TowerSubView";
import { QUESTS } from "@/adventure/data/quests";
import { useGame } from "@/adventure/GameContext";

export function CharacterScreen() {
  const {
    character,
    subView,
    setSubView,
    back,
    characterStateHook,
    inventory,
    adventureLog,
    notifications,
    effectiveSkillNameList,
    effectiveFeatNames,
    characterFeats,
    skillLayout,
    training,
    handleEquipFromInventory,
    handleUnequip,
    handleDiscardFromInventory,
    handleDepositToVault,
    handleWithdrawFromVault,
    quests,
    crafting,
  } = useGame();

  const activeQuestCount = QUESTS.reduce((n, q) => {
    const e = quests.getEntry(q.id);
    return e.state === "active" || e.state === "ready" ? n + 1 : n;
  }, 0);

  if (subView === null) {
    return (
      <div className="space-y-2">
        <EntryCard
          icon={<User size={28} weight="duotone" className="text-blue-500" />}
          title="내 정보"
          description="캐릭터 정보와 능력치를 확인합니다."
          onClick={() => setSubView("info")}
        />
        <EntryCard
          icon={
            <Backpack size={28} weight="duotone" className="text-emerald-500" />
          }
          title="가방"
          description="모험에 필요한 물건들을 챙길 수 있는 가방이다."
          onClick={() => setSubView("inventory")}
        />
        <EntryCard
          icon={
            <Sparkle size={28} weight="duotone" className="text-amber-500" />
          }
          title="스킬"
          description={
            character.skills.length > 0
              ? `보유 스킬 ${character.skills.length}개`
              : "아직 익힌 스킬이 없습니다."
          }
          onClick={() => setSubView("skills")}
        />
        <EntryCard
          icon={
            <BookOpen size={28} weight="duotone" className="text-emerald-600" />
          }
          title="모험의 서"
          description="지금까지의 여정과 발견을 기록합니다."
          onClick={() => setSubView("adventure-log")}
        />
        <EntryCard
          icon={
            <ClipboardText
              size={28}
              weight="duotone"
              className="text-yellow-700"
            />
          }
          title="의뢰 수첩"
          description={
            activeQuestCount > 0
              ? `진행 중인 의뢰 ${activeQuestCount}건`
              : "진행 중인 의뢰가 없습니다."
          }
          onClick={() => setSubView("quests")}
        />
        <EntryCard
          icon={<Scroll size={28} weight="duotone" className="text-rose-500" />}
          title="최근 기록"
          description={
            notifications.list.length > 0
              ? `최근 알림 ${notifications.list.length}개`
              : "아직 기록된 알림이 없습니다."
          }
          onClick={() => setSubView("recent-log")}
        />
        <EntryCard
          icon={<Crown size={28} weight="duotone" className="text-amber-500" />}
          title="고탑"
          description="영원히 끝나지 않는 수직 미궁. 일일 3회 도전."
          onClick={() => setSubView("tower")}
        />
      </div>
    );
  }

  if (subView === "tower") {
    return <TowerSubView />;
  }

  if (subView === "info") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="내 정보" onBack={back} />
        <CharacterMini character={character} />
        <Card as="section" padding="md">
          <div className="space-y-4">
            <AdventurerCard character={character} />
            <div className="border-t border-zinc-200 dark:border-zinc-800" />
            <StatsPanel stats={character.stats} />
          </div>
        </Card>
      </div>
    );
  }

  if (subView === "inventory") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="가방" onBack={back} />
        <InventoryView
          inventory={inventory.state}
          equipped={character.equipped}
          onEquip={handleEquipFromInventory}
          onUnequip={handleUnequip}
          onDiscard={handleDiscardFromInventory}
        />
      </div>
    );
  }

  if (subView === "skills") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="스킬" onBack={back} />
        <SkillsView
          skills={character.skills}
          equippedNames={effectiveSkillNameList}
          normalSlots={skillLayout.normalSlots}
          feats={characterFeats}
          equippedFeats={effectiveFeatNames}
          featSlots={skillLayout.featSlots}
          onEquip={(name) => {
            if (effectiveSkillNameList.includes(name)) return;
            if (effectiveSkillNameList.length >= skillLayout.normalSlots) return;
            characterStateHook.setEquippedSkills([
              ...effectiveSkillNameList,
              name,
            ]);
          }}
          onUnequip={(name) => {
            characterStateHook.setEquippedSkills(
              effectiveSkillNameList.filter((n) => n !== name),
            );
          }}
          onEquipFeat={(name) => {
            if (effectiveFeatNames.includes(name)) return;
            // 빈 슬롯 인덱스를 찾아 그 자리에 장착. 모두 차 있으면 무시.
            for (let i = 0; i < skillLayout.featSlots; i += 1) {
              if (!effectiveFeatNames[i]) {
                characterStateHook.setEquippedFeatAt(i, name);
                return;
              }
            }
          }}
          onUnequipFeat={(name) => {
            const slotIndex = effectiveFeatNames.indexOf(name);
            if (slotIndex >= 0) {
              characterStateHook.setEquippedFeatAt(slotIndex, null);
            }
          }}
        />
      </div>
    );
  }

  if (subView === "adventure-log") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="모험의 서" onBack={back} />
        <AdventureLogView
          log={adventureLog.log}
          stats={character.stats}
          equippedTitleId={characterStateHook.equippedTitleId}
          onEquipTitle={characterStateHook.setEquippedTitle}
          titleCounters={{
            battleLosses: adventureLog.log.battleLosses ?? 0,
            trainingCount: training.completedCount,
            chatCount: adventureLog.log.chatCount ?? 0,
            healingCount: adventureLog.log.healingCount ?? 0,
          }}
          knownRecipes={crafting.state.known}
          shareableRecipes={crafting.state.shareable}
          inventory={inventory.state}
          vault={inventory.state.vault}
          onDepositToVault={handleDepositToVault}
          onWithdrawFromVault={handleWithdrawFromVault}
        />
      </div>
    );
  }

  if (subView === "quests") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="의뢰 수첩" onBack={back} />
        <QuestJournalView getEntry={quests.getEntry} />
      </div>
    );
  }

  if (subView === "recent-log") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="최근 기록" onBack={back} />
        <RecentLogView
          notifications={notifications.list}
          onClear={notifications.clear}
        />
      </div>
    );
  }

  return null;
}
