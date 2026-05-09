"use client";

import {
  Barbell,
  FirstAid,
  Hammer,
  MapPin,
  Scroll,
  Storefront,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EntryCard } from "@/components/ui/EntryCard";
import { StatBar } from "@/components/ui/StatBar";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { TrainingView } from "@/adventure/character/TrainingView";
import { CraftingView } from "@/adventure/CraftingView";
import { ShopView } from "@/adventure/ShopView";
import { GuildView } from "@/adventure/GuildView";
import type { Character } from "@/adventure/character/types";
import type { ItemId } from "@/adventure/data/items";
import type { MaterialId } from "@/adventure/data/materials";
import type { PotionId } from "@/adventure/data/potions";
import type { Recipe } from "@/adventure/data/recipes";
import type { Region } from "@/adventure/data/world";
import type { MapProgress } from "@/lib/map-progress";
import { START_REGION_ID } from "@/adventure/data/world";
import type { useCharacterState } from "@/adventure/character/useCharacterState";
import type { useTraining } from "@/adventure/training/useTraining";
import type { useCrafting } from "@/adventure/crafting/useCrafting";
import type { useInventory } from "@/adventure/inventory/useInventory";
import type { useQuests } from "@/adventure/quests/useQuests";

type Props = {
  character: Character;
  currentRegion: Region;
  isTown: boolean;
  subView: string | null;
  setSubView: (next: string | null) => void;
  back: () => void;
  mapProgress: MapProgress;
  setMapProgress: React.Dispatch<React.SetStateAction<MapProgress>>;
  characterStateHook: ReturnType<typeof useCharacterState>;
  training: ReturnType<typeof useTraining>;
  crafting: ReturnType<typeof useCrafting>;
  inventory: ReturnType<typeof useInventory>;
  quests: ReturnType<typeof useQuests>;
  trainingDescription: string;
  onCraft: (recipe: Recipe) => void;
  onPurchasePotion: (id: PotionId, quantity: number) => void;
  onPurchaseMaterial: (id: MaterialId, quantity: number) => void;
  onSellPotion: (id: PotionId, quantity: number) => void;
  onSellMaterial: (id: MaterialId, quantity: number) => void;
  onSellEquipment: (id: ItemId, quantity: number) => void;
  onAcceptQuest: (id: string) => void;
  onClaimQuest: (id: string) => void;
};

export function TownScreen(props: Props) {
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
    trainingDescription,
    onCraft,
    onPurchasePotion,
    onPurchaseMaterial,
    onSellPotion,
    onSellMaterial,
    onSellEquipment,
    onAcceptQuest,
    onClaimQuest,
  } = props;

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
          onClick={() => {
            if (mapProgress.currentRegionId !== START_REGION_ID) {
              setMapProgress((prev) => ({
                currentRegionId: START_REGION_ID,
                visitedRegionIds: prev.visitedRegionIds.includes(
                  START_REGION_ID,
                )
                  ? prev.visitedRegionIds
                  : [...prev.visitedRegionIds, START_REGION_ID],
              }));
            }
            setSubView("healing");
          }}
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
            <Hammer size={28} weight="duotone" className="text-amber-600" />
          }
          title="대장간"
          description="장비를 두드려 벼리는 곳."
          onClick={() => setSubView("crafting")}
        />
        <EntryCard
          icon={
            <Scroll size={28} weight="duotone" className="text-stone-100" />
          }
          title="모험가 길드"
          description="의뢰를 받고 명성을 쌓을 수 있는 곳."
          onClick={() => setSubView("guild")}
        />
      </div>
    );
  }

  if (subView === "healing") {
    const healCost = character.gold < 50 ? 0 : 1;
    const isFull =
      character.hp >= character.maxHp && character.mp >= character.maxMp;
    return (
      <div className="space-y-3">
        <SubViewHeader title="시작 마을 치료소" onBack={back} />
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
            onClick={() =>
              characterStateHook.heal(
                healCost,
                character.maxHp,
                character.maxMp,
              )
            }
            disabled={isFull}
            className="mt-4 w-full rounded-md border border-rose-500 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400 dark:text-rose-300"
          >
            {isFull
              ? "이미 가득 차 있다"
              : healCost > 0
                ? `전부 회복 (${healCost} G)`
                : "전부 회복 (무료)"}
          </button>
        </Card>
      </div>
    );
  }

  if (subView === "training") {
    return (
      <div className="space-y-3">
        <SubViewHeader title="훈련장" onBack={back} />
        <TrainingView
          remaining={training.remaining}
          isTraining={training.isTraining}
          unspentPoints={training.unspentPoints}
          onStartTraining={training.startTraining}
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
          potionCounts={inventory.state.potions}
          potionMax={inventory.potionMax}
          onCraft={onCraft}
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
          onPurchasePotion={onPurchasePotion}
          onPurchaseMaterial={onPurchaseMaterial}
          onSellPotion={onSellPotion}
          onSellMaterial={onSellMaterial}
          onSellEquipment={onSellEquipment}
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
          onAccept={onAcceptQuest}
          onClaim={onClaimQuest}
        />
      </div>
    );
  }

  return null;
}
