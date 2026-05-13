"use client";

import {
  Barbell,
  FirstAid,
  Hammer,
  House,
  MapPin,
  Scroll,
  Sparkle,
  Storefront,
  UsersThree,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EntryCard } from "@/components/ui/EntryCard";
import { StatBar } from "@/components/ui/StatBar";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { TrainingView } from "@/adventure/character/TrainingView";
import {
  GrowthShrineView,
  revertPointPriceFor,
} from "@/adventure/character/GrowthShrineView";
import { StatsPanel } from "@/adventure/character/StatsPanel";
import { CraftingView } from "@/adventure/CraftingView";
import { ShopView } from "@/adventure/ShopView";
import { GuildView } from "@/adventure/GuildView";
import { GuildHallView } from "@/adventure/guild/GuildHallView";
import { SparringView } from "@/adventure/SparringView";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import { resolveBuffMultiplier } from "@/adventure/data/guildBuffs";
import { TRAINING_DURATION_MS } from "@/adventure/training/useTraining";
import { equipmentCountsAllGrades } from "@/adventure/inventory/ownership";
import { START_REGION_ID } from "@/adventure/data/world";
import { useGame } from "@/adventure/GameContext";

export function TownScreen() {
  const {
    character,
    currentRegion,
    isTown,
    subView,
    setSubView,
    back,
    mapProgress,
    setMapProgress,
    characterStateHook,
    training,
    crafting,
    inventory,
    quests,
    adventureLog,
    trainingDescription,
    playerCombat,
    playerStatus,
    autoPotion,
    autoHunt,
    notifications,
    handleCraft,
    handlePurchasePotion,
    handlePurchaseMaterial,
    handlePurchaseConsumable,
    handlePurchaseEquipment,
    handleSellPotion,
    handleSellMaterial,
    handleSellEquipment,
    handleAcceptQuest,
    handleClaimQuest,
    shopUnlocks,
    guildBuffs,
  } = useGame();

  if (!isTown) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white/40 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
        <MapPin
          size={40}
          weight="duotone"
          className="mx-auto text-zinc-400 dark:text-zinc-500"
        />
        <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
          이곳은 마을이 아닙니다
        </div>
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          마을의 시설은 마을 안에서만 이용할 수 있습니다.
        </div>
      </section>
    );
  }

  if (subView === null) {
    return (
      <div className="space-y-2">
        <EntryCard
          icon={
            <FirstAid size={28} weight="duotone" className="text-rose-500" />
          }
          title="치료소"
          description={
            character.hp >= character.maxHp && character.mp >= character.maxMp
              ? "체력과 마력이 가득 차 있다."
              : "지친 몸을 회복할 수 있는 곳."
          }
          onClick={() => setSubView("healing")}
        />
        <EntryCard
          icon={
            <Storefront
              size={28}
              weight="duotone"
              className="text-emerald-600"
            />
          }
          title="상점"
          description="물건을 사고 팔 수 있는 곳."
          onClick={() => setSubView("shop")}
        />
        <EntryCard
          icon={
            <Barbell size={28} weight="duotone" className="text-slate-400" />
          }
          title="훈련장"
          description={trainingDescription}
          onClick={() => setSubView("training")}
        />
        <EntryCard
          icon={
            <Sparkle size={28} weight="duotone" className="text-violet-400" />
          }
          title="성장의 신전"
          description={
            training.unspentPoints > 0
              ? `단련 포인트 ${training.unspentPoints}개를 능력치로 새겨넣을 수 있다.`
              : "단련을 능력치로 새겨넣는 곳."
          }
          onClick={() => setSubView("shrine")}
        />
        <EntryCard
          icon={
            <Hammer size={28} weight="duotone" className="text-amber-600" />
          }
          title="대장간"
          description="장비를 두드려 벼리는 곳."
          onClick={() => setSubView("crafting")}
        />
        <EntryCard
          icon={
            <Scroll size={28} weight="duotone" className="text-yellow-700" />
          }
          title="모험가 길드"
          description="의뢰를 받고 명성을 쌓을 수 있는 곳."
          onClick={() => setSubView("guild")}
        />
        <EntryCard
          icon={
            <UsersThree size={28} weight="duotone" className="text-violet-600" />
          }
          title="길드 회관"
          description="모험가들이 서로 작은 길드를 꾸리는 곳."
          onClick={() => setSubView("guild_hall")}
        />
      </div>
    );
  }

  if (subView === "healing") {
    const healCost = character.gold < 50 ? 0 : 1;
    const isFull =
      character.hp >= character.maxHp && character.mp >= character.maxMp;
    // 위탁 원정 중에는 치유소 회복을 막지만, HP가 0이면 예외 — 시련 등에서 쓰러져
    // 마을로 복귀한 직후 회복도 이동도 못 해 갇히는 상황을 푼다. 원정은 그대로
    // 진행되고, 수령 시 서버가 baseline HP 기준으로 결과를 적용하므로 desync 없음.
    const blockedByHunt = autoHunt.isDispatched && character.hp > 0;
    const respawnId = mapProgress.respawnRegionId ?? START_REGION_ID;
    const isRespawnHere = respawnId === currentRegion.id;
    return (
      <div className="space-y-3">
        <SubViewHeader title={`${currentRegion.name} 치료소`} onBack={back} />
        <Card as="section" padding="md">
          <div className="flex items-center gap-3">
            <FirstAid
              size={32}
              weight="duotone"
              className="shrink-0 text-rose-500"
            />
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              체력과 마력을 모두 회복할 수 있다. 비용 1 G — 소지금이 50 G
              미만이면 무료.
            </p>
          </div>
          <div className="mt-4 space-y-2">
            <StatBar
              label="HP"
              value={character.hp}
              max={character.maxHp}
              color="bg-red-500"
            />
            <StatBar
              label="MP"
              value={character.mp}
              max={character.maxMp}
              color="bg-sky-500"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (blockedByHunt) return;
              characterStateHook.heal(
                healCost,
                character.maxHp,
                character.maxMp,
              );
              adventureLog.incrementHealingCount();
            }}
            disabled={isFull || blockedByHunt}
            className="mt-4 w-full rounded-md border border-rose-500 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400 dark:text-rose-300"
          >
            {blockedByHunt
              ? "자동 사냥 중 — 회복 불가"
              : isFull
                ? "이미 가득 차 있다"
                : healCost > 0
                  ? `전부 회복 (${healCost} G)`
                  : "전부 회복 (무료)"}
          </button>
          {autoHunt.isDispatched && character.hp <= 0 && (
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              자동 사냥 중이지만, 쓰러진 상태라 회복은 가능합니다. 원정은 그대로
              진행됩니다.
            </p>
          )}
        </Card>
        <Card as="section" padding="md">
          <div className="flex items-center gap-3">
            <House
              size={28}
              weight="duotone"
              className="shrink-0 text-amber-500"
            />
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              패배 시 이 마을의 치유소로 복귀한다.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setMapProgress((prev) => ({
                ...prev,
                respawnRegionId: currentRegion.id,
              }))
            }
            disabled={isRespawnHere}
            className="mt-3 w-full rounded-md border border-amber-500 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-400 dark:text-amber-300"
          >
            {isRespawnHere
              ? "이미 복귀 지점입니다"
              : "이곳을 복귀 지점으로 설정"}
          </button>
        </Card>
      </div>
    );
  }

  if (subView === "training") {
    const trainSpeedMult = resolveBuffMultiplier(guildBuffs, "train_speed_mult");
    const trainDurationMs = Math.round(TRAINING_DURATION_MS * trainSpeedMult);
    return (
      <div className="space-y-3">
        <SubViewHeader title="훈련장" onBack={back} />
        <TrainingView
          remaining={training.remaining}
          isTraining={training.isTraining}
          durationMs={trainDurationMs}
          unspentPoints={training.unspentPoints}
          completedCount={training.completedCount}
          onStartTraining={() => training.startTraining(trainSpeedMult)}
          onStartSparring={() => setSubView("sparring")}
        />
      </div>
    );
  }

  if (subView === "sparring") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="스파링" onBack={back} />
        <SparringView
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
          recentNotifications={notifications.list}
        />
      </div>
    );
  }

  if (subView === "shrine") {
    // baseStats = 총 스탯에서 분배분만 뺀 값(베이스+장비). GrowthShrineView 가
    // total = baseStats + allocated 로 합산해 표시하므로 결과는 character.stats 와 일치.
    const baseStatsForShrine = STAT_KEYS.reduce<Record<StatKey, number>>(
      (acc, k) => {
        acc[k] = (character.stats[k] ?? 0) - (training.allocatedStats[k] ?? 0);
        return acc;
      },
      {} as Record<StatKey, number>,
    );
    return (
      <div className="space-y-3">
        <SubViewHeader title="성장의 신전" onBack={back} />
        <Card as="section" padding="md">
          <StatsPanel stats={character.stats} />
        </Card>
        <GrowthShrineView
          unspentPoints={training.unspentPoints}
          revertPoints={training.revertPoints}
          allocatedStats={training.allocatedStats}
          baseStats={baseStatsForShrine}
          gold={character.gold}
          level={character.level}
          onCommit={training.commitAllocations}
          onBuyRevertPoint={(qty) => {
            const price = revertPointPriceFor(character.level) * qty;
            if (character.gold < price) return;
            characterStateHook.addGold(-price);
            training.addRevertPoints(qty);
          }}
        />
      </div>
    );
  }

  if (subView === "crafting") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="대장간" onBack={back} />
        <CraftingView
          knownIds={crafting.state.known}
          materialCounts={inventory.state.materials}
          equipmentCounts={equipmentCountsAllGrades(inventory.state)}
          potionCounts={inventory.state.potions}
          potionMax={inventory.potionMax}
          onCraft={handleCraft}
        />
      </div>
    );
  }

  if (subView === "shop") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="상점" onBack={back} />
        <ShopView
          gold={character.gold}
          inventory={inventory.state}
          isMaterialBuyable={shopUnlocks.isUnlocked}
          onPurchasePotion={handlePurchasePotion}
          onPurchaseMaterial={handlePurchaseMaterial}
          onPurchaseConsumable={handlePurchaseConsumable}
          onPurchaseEquipment={handlePurchaseEquipment}
          onSellPotion={handleSellPotion}
          onSellMaterial={handleSellMaterial}
          onSellEquipment={handleSellEquipment}
        />
      </div>
    );
  }

  if (subView === "guild") {
    return (
      <div className="space-y-3">
        <SubViewHeader
          title={`모험가 길드 · ${currentRegion.name}`}
          onBack={back}
        />
        <GuildView
          regionId={currentRegion.id}
          characterLevel={character.level}
          getEntry={quests.getEntry}
          onAccept={handleAcceptQuest}
          onClaim={handleClaimQuest}
        />
      </div>
    );
  }

  if (subView === "guild_hall") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="길드 회관" onBack={back} />
        <GuildHallView />
      </div>
    );
  }

  return null;
}
