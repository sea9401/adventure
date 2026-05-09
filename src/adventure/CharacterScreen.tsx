"use client";

import {
  Backpack,
  BookOpen,
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
import { SKILL_SLOT_COUNT } from "@/adventure/character/skills";
import { AdventureLogView } from "@/adventure/AdventureLogView";
import { InventoryView } from "@/adventure/InventoryView";
import { RecentLogView } from "@/adventure/RecentLogView";
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
    training,
    handleEquipFromInventory,
    handleUnequip,
  } = useGame();

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
          icon={<Scroll size={28} weight="duotone" className="text-rose-500" />}
          title="최근 기록"
          description={
            notifications.list.length > 0
              ? `최근 알림 ${notifications.list.length}개`
              : "아직 기록된 알림이 없습니다."
          }
          onClick={() => setSubView("recent-log")}
        />
      </div>
    );
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
          onEquip={(name) => {
            if (effectiveSkillNameList.includes(name)) return;
            if (effectiveSkillNameList.length >= SKILL_SLOT_COUNT) return;
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
        />
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
