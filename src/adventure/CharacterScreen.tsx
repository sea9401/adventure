"use client";

import {
  Backpack,
  BookOpen,
  ClipboardText,
  Crown,
  Diamond,
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
import { computeCompendiumReward } from "@/adventure/log/compendiumReward";
import { RuneView } from "@/adventure/RuneView";
import {
  isFusionError,
  planRuneFusion,
} from "@/adventure/character/runeFusion";
import type { RuneGrade, RuneId } from "@/adventure/data/runes";
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
    addNotification,
    handleEquipFromInventory,
    handleUnequip,
    handleDiscardFromInventory,
    handleDepositToVault,
    handleWithdrawFromVault,
    handlePurchaseRune,
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
        <EntryCard
          icon={<Diamond size={28} weight="duotone" className="text-violet-500" />}
          title="룬"
          description="3개의 슬롯에 룬을 장착해 영구 능력치를 더한다."
          onClick={() => setSubView("runes")}
        />
      </div>
    );
  }

  if (subView === "runes") {
    const tokenCount = inventory.materialCount("tower_token");
    const handleFuseRune = (id: RuneId, grade: RuneGrade) => {
      const have = inventory.runeCount(id, grade);
      const plan = planRuneFusion(id, grade, have);
      if (isFusionError(plan)) {
        if (plan === "max_grade") {
          addNotification("info", "5등급 룬은 합성할 수 없다.");
        } else {
          addNotification(
            "info",
            "합성에 필요한 룬이 부족하다 (동일 등급 3개 필요).",
          );
        }
        return;
      }
      if (!inventory.consumeRune(id, grade, plan.consumed)) return;
      inventory.addRune(id, plan.toGrade, plan.produced);
      addNotification(
        "info",
        `${grade}등급 × ${plan.consumed} → ${plan.toGrade}등급 ×1 합성.`,
      );
    };
    return (
      <div className="space-y-3">
        <SubViewHeader title="룬" onBack={back} />
        <RuneView
          equippedRunes={characterStateHook.state.equippedRunes ?? []}
          runeInventory={inventory.state.runes ?? {}}
          tokenCount={tokenCount}
          onEquip={(slotIndex, rune) =>
            characterStateHook.setEquippedRuneAt(slotIndex, rune)
          }
          onFuse={handleFuseRune}
          onBuy={(id, grade) => handlePurchaseRune(id, grade, 1)}
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
    const reward = computeCompendiumReward(adventureLog.log);
    const handleClaimCompendium = () => {
      if (reward.available <= 0) return;
      const n = reward.available;
      training.addPoints(n);
      adventureLog.addCompendiumClaimed(n);
      addNotification(
        "info",
        `도감 마일스톤으로 단련 포인트 +${n} 수령했다.`,
      );
    };
    return (
      <div className="space-y-3">
        <SubViewHeader
          title="모험의 서"
          onBack={back}
          right={
            reward.available > 0 ? (
              <button
                type="button"
                onClick={handleClaimCompendium}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
              >
                <Sparkle size={14} weight="duotone" />
                단련 +{reward.available} 수령
              </button>
            ) : undefined
          }
        />
        <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
          도감 등록 {reward.counts.total}개 · 다음 단련 +1까지{" "}
          {reward.toNext}개
        </p>
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
