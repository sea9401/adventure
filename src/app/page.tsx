"use client";

import { useEffect, useRef, useState } from "react";
import {
  Backpack,
  Barbell,
  BookOpen,
  Coins,
  Compass,
  FirstAid,
  Hammer,
  MapPin,
  Scroll,
  Sparkle,
  Storefront,
  Sword,
  User,
} from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NameSetupModal } from "@/components/NameSetupModal";
import { MapView } from "@/adventure/MapView";
import { BattleView, type BattleEndPayload } from "@/adventure/BattleView";
import { TownView } from "@/adventure/TownView";
import { AdventureLogView } from "@/adventure/AdventureLogView";
import { useAdventureLog } from "@/adventure/log/useAdventureLog";
import { WORLD_MAP } from "@/adventure/data/world";
import {
  initialMapProgress,
  loadMapProgress,
  saveMapProgress,
  type MapProgress,
} from "@/lib/map-progress";
import { START_REGION_ID } from "@/adventure/data/world";
import { NotificationBell } from "@/components/NotificationBell";
import { NotificationToast } from "@/components/NotificationToast";
import { RecentLogView } from "@/adventure/RecentLogView";
import { GuildView } from "@/adventure/GuildView";
import { useQuests } from "@/adventure/quests/useQuests";
import { getQuestById } from "@/adventure/data/quests";
import {
  applyQuestReward,
  type RewardServices,
} from "@/adventure/quests/applyReward";
import { ITEMS, findItemId, type ItemId } from "@/adventure/data/items";
import {
  getItemSellPrice,
  getMaterialSellPrice,
  getPotionSellPrice,
} from "@/adventure/data/sellPrices";
import { MONSTERS } from "@/adventure/data/monsters";
import {
  POTIONS,
  POTION_MAX_PER_TYPE,
  type PotionId,
} from "@/adventure/data/potions";
import { useInventory } from "@/adventure/inventory/useInventory";
import { useAutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";
import { InventoryView } from "@/adventure/InventoryView";
import { ShopView } from "@/adventure/ShopView";
import { type Recipe } from "@/adventure/data/recipes";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { useCrafting } from "@/adventure/crafting/useCrafting";
import { requiredExpToNext } from "@/lib/leveling";
import { CraftingView } from "@/adventure/CraftingView";
import type { NotificationKind } from "@/lib/notifications";
import { useNotifications } from "@/adventure/notifications/useNotifications";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { StatBar } from "@/components/ui/StatBar";
import { EntryCard } from "@/components/ui/EntryCard";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { RegionBackground } from "@/components/ui/RegionBackground";
import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import { formatDuration } from "@/lib/format";
import type { Character } from "@/adventure/character/types";
import { ZERO_ALLOCATED } from "@/adventure/character/statMeta";
import { AdventurerCard } from "@/adventure/character/AdventurerCard";
import { StatsPanel } from "@/adventure/character/StatsPanel";
import { CharacterMini } from "@/adventure/character/CharacterMini";
import { SkillsView } from "@/adventure/character/SkillsView";
import { TrainingView } from "@/adventure/character/TrainingView";
import { useTraining } from "@/adventure/training/useTraining";
import {
  baseCharacter,
  maxHpForLevel,
  maxMpForLevel,
} from "@/adventure/character/defaults";
import { useCharacterState } from "@/adventure/character/useCharacterState";
import { useProfile } from "@/adventure/profile/useProfile";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { useOfflineSimulation } from "@/adventure/battle/useOfflineSimulation";
import {
  simulateOfflineHunt,
  summarizeOfflineResult,
  OFFLINE_SIM_MAX_MS,
} from "@/adventure/battle/offlineSim";
import { PLAYER_TURN_INTERVAL_MS } from "@/adventure/battle/useBattle";
import { TrainerDialogue } from "@/adventure/town/dialogues/TrainerDialogue";
import { BlacksmithDialogue } from "@/adventure/town/dialogues/BlacksmithDialogue";

type TabKey = "adventure" | "town" | "character";

const TABS: { key: TabKey; label: string }[] = [
  { key: "adventure", label: "모험" },
  { key: "town", label: "마을" },
  { key: "character", label: "캐릭터" },
];

function MainTabs({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (next: TabKey) => void;
}) {
  return (
    <TabBar
      tabs={TABS}
      active={active}
      onChange={onChange}
      ariaLabel="메인 탭"
      size="md"
      className="mx-auto w-full max-w-2xl px-4 sm:px-6"
    />
  );
}

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<TabKey>("adventure");
  const [subView, setSubView] = useState<string | null>(null);
  const [mapProgress, setMapProgress] =
    useState<MapProgress>(initialMapProgress);
  const adventureLog = useAdventureLog();
  const quests = useQuests();
  const crafting = useCrafting();
  const inventory = useInventory();
  const autoPotion = useAutoPotionConfig();
  const training = useTraining();
  const characterStateHook = useCharacterState();
  const characterState = characterStateHook.state;
  const profile = useProfile();
  const notifications = useNotifications();

  useEffect(() => {
    // localStorage 는 클라이언트 마운트 후에만 접근 가능 — useEffect 1회 hydrate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMapProgress(loadMapProgress());

    setHydrated(true);
  }, []);

  // 마을 탭에 있는데 현재 위치가 마을이 아니면 서브뷰 강제 종료
  useEffect(() => {
    const currentTags = WORLD_MAP.regions.find(
      (r) => r.id === mapProgress.currentRegionId,
    )?.tags;
    const inTown = currentTags?.includes("town") ?? false;
    if (tab === "town" && !inTown) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubView(null);
    }
  }, [tab, mapProgress.currentRegionId]);

  // 지도 진행 상태 영속
  useEffect(() => {
    if (!hydrated) return;
    saveMapProgress(mapProgress);
  }, [hydrated, mapProgress]);

  const handleTabChange = (next: TabKey) => {
    setTab(next);
    setSubView(null);
  };

  const trainingDescription = training.isTraining
    ? `훈련 중 · ${formatDuration(training.remaining)}`
    : training.unspentPoints > 0
      ? `단련 포인트 ${training.unspentPoints}개 보유`
      : "능력치를 단련할 수 있는 곳.";

  const equippedSlots = characterStateHook.equippedSlots;
  // 장비 bonus의 스탯 부분(str/dex/vit/spd/luk) 합산. atk/def는 playerCombat 단계에서 따로 처리.
  const equipStatBonuses: Record<StatKey, number> = { ...ZERO_ALLOCATED };
  for (const item of [
    equippedSlots.weapon,
    equippedSlots.armor,
    equippedSlots.accessory,
  ]) {
    if (!item?.bonus) continue;
    for (const k of STAT_KEYS) {
      equipStatBonuses[k] += item.bonus[k] ?? 0;
    }
  }

  const characterMaxHp = maxHpForLevel(characterState.level);
  const characterMaxMp = maxMpForLevel(characterState.level);
  const character: Character = {
    ...baseCharacter,
    name: profile.name,
    gender: profile.gender,
    hp: Math.min(characterState.hp, characterMaxHp),
    mp: Math.min(characterState.mp, characterMaxMp),
    maxHp: characterMaxHp,
    maxMp: characterMaxMp,
    level: characterState.level,
    exp: characterState.exp,
    maxExp: requiredExpToNext(characterState.level) ?? 0,
    gold: characterState.gold,
    fame: characterState.fame,
    equipped: equippedSlots,
    stats: STAT_KEYS.reduce<Record<StatKey, number>>(
      (acc, k) => {
        acc[k] =
          baseCharacter.stats[k] + training.allocatedStats[k] + equipStatBonuses[k];
        return acc;
      },
      {} as Record<StatKey, number>,
    ),
  };
  const showModal = profile.needsSetup;
  const currentRegion =
    WORLD_MAP.regions.find((r) => r.id === mapProgress.currentRegionId) ??
    WORLD_MAP.regions[0];
  const isTown = currentRegion.tags?.includes("town") ?? false;

  useEffect(() => {
    adventureLog.markRegionVisited(currentRegion.id);
  }, [currentRegion.id, adventureLog]);

  const lastSeenLevelRef = useRef<number | null>(null);

  // 전투 엔진용 PlayerCombat — 장비 보너스 합산.
  const equippedItems = [
    character.equipped.weapon,
    character.equipped.armor,
    character.equipped.accessory,
  ];
  const equipAtk = equippedItems.reduce(
    (sum, item) => sum + (item?.bonus?.atk ?? 0),
    0,
  );
  const equipDef = equippedItems.reduce(
    (sum, item) => sum + (item?.bonus?.def ?? 0),
    0,
  );
  // 스탯 → 전투 수치 변환:
  //   힘   STR : +1 atk / pt
  //   민첩 DEX : +1% 회피 / pt
  //   활력 VIT : +2 def / pt
  //   속도 SPD : 10pt 당 공격 횟수 +1 (베이스 1회)
  //   행운 LUK : +1% 드랍률 / pt (드랍 시스템 도입 시 사용)
  const playerCombat = {
    hp: character.hp,
    maxHp: character.maxHp,
    atk: character.stats.str + equipAtk,
    def: character.stats.vit * 2 + equipDef,
    spd: character.stats.spd,
    evasionPct: character.stats.dex,
    attackCount: 1 + Math.floor(character.stats.spd / 10),
  };

  const handlePurchasePotion = (id: PotionId, quantity: number) => {
    const potion = POTIONS[id];
    if (!potion) return;
    const have = inventory.state.potions[id] ?? 0;
    const room = Math.max(0, POTION_MAX_PER_TYPE - have);
    const buyQty = Math.min(quantity, room);
    if (buyQty <= 0) return;
    const cost = potion.price * buyQty;
    if (characterState.gold < cost) return;
    characterStateHook.addGold(-cost);
    inventory.add(id, buyQty);
  };

  const handlePurchaseMaterial = (id: MaterialId, quantity: number) => {
    const m = MATERIALS[id];
    if (!m) return;
    const cost = m.price * quantity;
    if (characterState.gold < cost) return;
    characterStateHook.addGold(-cost);
    inventory.addMaterial(id, quantity);
  };

  const addNotification = (kind: NotificationKind, text: string) =>
    notifications.add(kind, text);

  // 판매 — 인벤토리에서 차감 + 골드 지급. 0G 아이템은 단순 정리(버리기) 효과.
  const handleSellPotion = (id: PotionId, quantity: number) => {
    if (quantity <= 0) return;
    if (!inventory.consume(id, quantity)) return;
    const total = getPotionSellPrice(id) * quantity;
    if (total > 0) characterStateHook.addGold(total);
    addNotification(
      "info",
      total > 0
        ? `${POTIONS[id].name} ×${quantity}을(를) ${total}G에 팔았다.`
        : `${POTIONS[id].name} ×${quantity}을(를) 버렸다.`,
    );
  };

  const handleSellMaterial = (id: MaterialId, quantity: number) => {
    if (quantity <= 0) return;
    if (!inventory.consumeMaterial(id, quantity)) return;
    const total = getMaterialSellPrice(id) * quantity;
    if (total > 0) characterStateHook.addGold(total);
    addNotification(
      "info",
      total > 0
        ? `${MATERIALS[id].name} ×${quantity}을(를) ${total}G에 팔았다.`
        : `${MATERIALS[id].name} ×${quantity}을(를) 버렸다.`,
    );
  };

  const handleSellEquipment = (id: ItemId, quantity: number) => {
    if (quantity <= 0) return;
    if (!inventory.consumeEquipment(id, quantity)) return;
    const total = getItemSellPrice(id) * quantity;
    if (total > 0) characterStateHook.addGold(total);
    const name = ITEMS[id].name;
    addNotification(
      "info",
      total > 0
        ? `${name}${quantity > 1 ? ` ×${quantity}` : ""}을(를) ${total}G에 팔았다.`
        : `${name}${quantity > 1 ? ` ×${quantity}` : ""}을(를) 버렸다.`,
    );
  };

  // 레벨업 감지 — character.level 증가 시 스탯 포인트 지급 + 알림.
  // 초기 로드(localStorage 동기화)는 무시하기 위해 ref가 null이면 베이스라인만 기록.
  useEffect(() => {
    if (lastSeenLevelRef.current === null) {
      lastSeenLevelRef.current = characterState.level;
      return;
    }
    const prev = lastSeenLevelRef.current;
    const next = characterState.level;
    if (next > prev) {
      const gained = next - prev;
      training.addPoints(gained);
      addNotification(
        "info",
        `레벨업! Lv.${next} (스탯 포인트 +${gained})`,
      );
    }
    lastSeenLevelRef.current = next;
    // addNotification/training.addPoints 는 setter — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterState.level]);

  // 인벤토리에서 장비를 꺼내 장착. 보유분에서 1개 차감, 기존 장비는 회수.
  // ITEMS 사전에 등록된 아이템만 회수 가능 (이름 기반 역추적).
  const handleEquipFromInventory = (id: ItemId) => {
    if (!inventory.consumeEquipment(id, 1)) return;
    const item = ITEMS[id];
    const oldId = findItemId(characterStateHook.equippedSlots[item.slot]);
    if (oldId) inventory.addEquipment(oldId, 1);
    characterStateHook.setSlot(item.slot, item);
    addNotification("info", `${item.name}을(를) 장착했다.`);
  };

  const handleCraft = (recipe: Recipe) => {
    // 재료 검사 — 부족하면 알림만 띄우고 중단.
    for (const ing of recipe.ingredients) {
      if (inventory.materialCount(ing.materialId) < ing.count) {
        const name = MATERIALS[ing.materialId].name;
        addNotification(
          "info",
          `재료가 부족하다 — ${name} ${ing.count}개 필요.`,
        );
        return;
      }
    }
    // 차감.
    for (const ing of recipe.ingredients) {
      inventory.consumeMaterial(ing.materialId, ing.count);
    }
    crafting.markCrafted(recipe.id);

    if (recipe.result.kind === "equipment") {
      const item = ITEMS[recipe.result.itemId];
      inventory.addEquipment(recipe.result.itemId);
      addNotification("info", `${item.name}을(를) 만들었다.`);
    } else {
      const potion = POTIONS[recipe.result.potionId];
      inventory.add(recipe.result.potionId, recipe.result.quantity);
      const qty = recipe.result.quantity;
      addNotification(
        "info",
        qty > 1
          ? `${potion.name} ×${qty}을(를) 만들었다.`
          : `${potion.name}을(를) 만들었다.`,
      );
    }
  };

  const handleBattleEnd = (payload: BattleEndPayload) => {
    if (payload.outcome === "win") {
      adventureLog.addKill(payload.enemyName);
      const readyQuestIds = quests.recordKill(payload.enemyName);
      characterStateHook.setHp(payload.finalPlayerHp);
      characterStateHook.addExp(payload.rewards.exp);
      // 드롭 판정 — 몬스터의 drops 정의대로 확률 굴림.
      const monster = MONSTERS[payload.enemyName];
      if (monster?.drops) {
        for (const drop of monster.drops) {
          if (Math.random() < drop.chance) {
            inventory.addMaterial(drop.materialId, 1);
            addNotification(
              "info",
              `${MATERIALS[drop.materialId].name}을(를) 손에 넣었다.`,
            );
          }
        }
      }
      const reward =
        payload.rewards.exp > 0 ? `EXP +${payload.rewards.exp}` : "보상 없음";
      addNotification(
        "battle_win",
        `${payload.enemyName}을(를) 쓰러뜨렸다 — ${reward}`,
      );
      for (const id of readyQuestIds) {
        const quest = getQuestById(id);
        if (quest) {
          addNotification(
            "quest_ready",
            `의뢰 조건 달성 — ${quest.title}: 길드에서 보상을 받을 수 있다.`,
          );
        }
      }
    } else {
      // 패배 — HP 회복 + 시작 마을 강제 이동
      characterStateHook.restoreHpFull();
      setMapProgress((prev) => ({
        currentRegionId: START_REGION_ID,
        visitedRegionIds: prev.visitedRegionIds.includes(START_REGION_ID)
          ? prev.visitedRegionIds
          : [...prev.visitedRegionIds, START_REGION_ID],
      }));
      addNotification(
        "battle_lose",
        `${payload.enemyName}에게 쓰러졌다... 시작 마을로 돌아왔다.`,
      );
    }
  };

  const handleAcceptQuest = (id: string) => {
    quests.accept(id);
  };

  // 오프라인 자동 사냥 — 페이지를 떠난 동안 일어났을 일을 결정적으로 한 번에 시뮬.
  // 30분 cap + 사망 시 break + 시작 마을 이동.
  useOfflineSimulation({
    enabled: hydrated && currentRegion.enemies.length > 0,
    regionId: currentRegion.id,
    runSim: (awayMs) =>
      simulateOfflineHunt({
        player: playerCombat,
        playerName: profile.name,
        region: currentRegion,
        potions: inventory.state.potions,
        turnIntervalMs: PLAYER_TURN_INTERVAL_MS,
        awayMs,
        pickAction: (state) =>
          pickAutoAction(state, {
            rules: autoPotion.config.rules,
            potions: inventory.state.potions,
          }),
      }),
    onApply: (result) => {
      // 처치 — 도감/퀘스트 진행 누적. 퀘스트 ready 알림은 한 번에 하나만 의미 있어 첫 트리거만 띄움.
      const readyQuestIds = new Set<string>();
      for (const [name, n] of Object.entries(result.killsByName)) {
        for (let i = 0; i < n; i += 1) {
          adventureLog.addKill(name);
          for (const id of quests.recordKill(name)) readyQuestIds.add(id);
        }
      }
      // 포션 차감
      for (const [id, n] of Object.entries(result.potionsConsumed)) {
        if (n) inventory.consume(id as PotionId, n);
      }
      // EXP/HP/사망
      if (result.expGained > 0) characterStateHook.addExp(result.expGained);
      if (result.died) {
        characterStateHook.restoreHpFull();
        setMapProgress((prev) => ({
          currentRegionId: START_REGION_ID,
          visitedRegionIds: prev.visitedRegionIds.includes(START_REGION_ID)
            ? prev.visitedRegionIds
            : [...prev.visitedRegionIds, START_REGION_ID],
        }));
      } else {
        characterStateHook.setHp(result.finalPlayerHp);
      }
      // 요약 알림
      const summary = summarizeOfflineResult(result);
      const minutes = Math.max(1, Math.round(result.simulatedMs / 60_000));
      const cap =
        result.cappedByLimit
          ? ` (${OFFLINE_SIM_MAX_MS / 60_000}분 cap)`
          : "";
      addNotification(
        result.died ? "battle_lose" : "info",
        `오프라인 사냥 ${minutes}분${cap}${summary ? ` — ${summary}` : ""}`,
      );
      for (const id of readyQuestIds) {
        const quest = getQuestById(id);
        if (quest) {
          addNotification(
            "quest_ready",
            `의뢰 조건 달성 — ${quest.title}: 길드에서 보상을 받을 수 있다.`,
          );
        }
      }
    },
  });

  const rewardServices: RewardServices = {
    addPotion: (id, n) => inventory.add(id, n),
    addMaterial: (id, n) => inventory.addMaterial(id, n),
    addEquipment: (id) => inventory.addEquipment(id),
    learnRecipe: (id) => crafting.learnRecipe(id),
    addGoldFame: characterStateHook.addGoldFame,
    addExp: characterStateHook.addExp,
  };

  // 퀘스트 보상 지급 + 알림 한 줄로 합성. NPC 다이얼로그/길드 게시판 공용.
  const completeQuest = (id: string): boolean => {
    const result = quests.claim(id);
    if (!result.ok) return false;
    const tokens = applyQuestReward(result.quest.reward, rewardServices);
    addNotification(
      "quest_complete",
      tokens.length > 0
        ? `${result.quest.title} 완료 — ${tokens.join(", ")}`
        : `${result.quest.title} 완료`,
    );
    return true;
  };

  const handleClaimQuest = (id: string) => {
    completeQuest(id);
  };


  return (
    <>
      <RegionBackground
        regionId={currentRegion.id}
        imageOverride={currentRegion.image}
      />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 py-3 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="shrink-0 text-xl font-semibold tracking-wide">무슨무슨게임</h1>
            <span className="truncate text-base text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {character.name}
              </span>
              <span className="ml-2 text-zinc-500 dark:text-zinc-500">
                Lv.{character.level}
              </span>
              <span className="ml-2 inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-500">
                <MapPin size={14} weight="fill" className="text-rose-500" />
                {currentRegion.name}
              </span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-zinc-700 dark:text-zinc-200">
              <Coins size={20} weight="fill" className="text-yellow-500" />
              {character.gold.toLocaleString()}
            </span>
            <NotificationBell
              notifications={notifications.alertable}
              unreadCount={notifications.unreadCount}
              onOpen={notifications.markRead}
            />
            <ThemeToggle />
          </div>
        </header>

        <MainTabs active={tab} onChange={handleTabChange} />

        <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6">
          {tab === "adventure" && subView === null && (
            <>
              <CharacterMini character={character} />
              <div className="space-y-2">
                {currentRegion.tags?.includes("town") && (
                  <EntryCard
                    icon={
                      <User
                        size={28}
                        weight="duotone"
                        className="text-blue-500"
                      />
                    }
                    title={currentRegion.name}
                    description="마을을 둘러보고 사람들과 이야기합니다."
                    onClick={() => setSubView("town")}
                  />
                )}
                {currentRegion.enemies.length > 0 && (
                  <EntryCard
                    icon={
                      <Sword
                        size={28}
                        weight="duotone"
                        className="text-rose-500"
                      />
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
          )}
          {tab === "adventure" && subView === "town" && (
            <div className="space-y-3">
              <SubViewHeader
                title={currentRegion.name}
                onBack={() => setSubView(null)}
              />
              <TownView
                region={currentRegion}
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
                  return null;
                }}
              />
            </div>
          )}
          {tab === "adventure" && subView === "battle" && (
            <div className="space-y-3">
              <SubViewHeader title="전투" onBack={() => setSubView(null)} />
              <BattleView
                region={currentRegion}
                player={playerCombat}
                playerName={character.name}
                onBattleStart={adventureLog.markEncountered}
                onBattleEnd={handleBattleEnd}
                consumePotion={inventory.consume}
                pickAutoAction={(state) =>
                  pickAutoAction(state, {
                    rules: autoPotion.config.rules,
                    potions: inventory.state.potions,
                  })
                }
                inventoryState={inventory.state}
                autoPotionConfig={autoPotion.config}
                onUpdateAutoPotionRule={autoPotion.updateRule}
              />
            </div>
          )}
          {tab === "adventure" && subView === "map" && (
            <div className="space-y-3">
              <SubViewHeader title="지도" onBack={() => setSubView(null)} />
              <MapView
                progress={mapProgress}
                onProgressChange={setMapProgress}
                log={adventureLog.log}
              />
            </div>
          )}

          {tab === "town" && !isTown && (
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
          )}
          {tab === "town" && isTown && subView === null && (
            <div className="space-y-2">
              <EntryCard
                icon={
                  <FirstAid
                    size={28}
                    weight="duotone"
                    className="text-rose-500"
                  />
                }
                title="치유소"
                description={
                  character.hp >= character.maxHp &&
                  character.mp >= character.maxMp
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
                  <Barbell
                    size={28}
                    weight="duotone"
                    className="text-slate-400"
                  />
                }
                title="훈련장"
                description={trainingDescription}
                onClick={() => setSubView("training")}
              />
              <EntryCard
                icon={
                  <Hammer
                    size={28}
                    weight="duotone"
                    className="text-amber-600"
                  />
                }
                title="대장간"
                description="장비를 두드려 벼리는 곳."
                onClick={() => setSubView("crafting")}
              />
              <EntryCard
                icon={
                  <Scroll
                    size={28}
                    weight="duotone"
                    className="text-stone-100"
                  />
                }
                title="모험가 길드"
                description="의뢰를 받고 명성을 쌓을 수 있는 곳."
                onClick={() => setSubView("guild")}
              />
            </div>
          )}
          {tab === "town" && isTown && subView === "healing" && (
            <div className="space-y-3">
              <SubViewHeader title="치유소" onBack={() => setSubView(null)} />
              <Card as="section" padding="md">
                <div className="flex items-center gap-3">
                  <FirstAid
                    size={32}
                    weight="duotone"
                    className="shrink-0 text-rose-500"
                  />
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    체력과 마력을 모두 회복할 수 있다. 지금은 무료.
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
                  onClick={characterStateHook.heal}
                  disabled={
                    character.hp >= character.maxHp &&
                    character.mp >= character.maxMp
                  }
                  className="mt-4 w-full rounded-md border border-rose-500 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400 dark:text-rose-300"
                >
                  {character.hp >= character.maxHp &&
                  character.mp >= character.maxMp
                    ? "이미 가득 차 있다"
                    : "전부 회복"}
                </button>
              </Card>
            </div>
          )}
          {tab === "town" && isTown && subView === "training" && (
            <div className="space-y-3">
              <SubViewHeader title="훈련장" onBack={() => setSubView(null)} />
              <TrainingView
                remaining={training.remaining}
                isTraining={training.isTraining}
                unspentPoints={training.unspentPoints}
                onStartTraining={training.startTraining}
                onAllocateStat={training.allocateStat}
              />
            </div>
          )}
          {tab === "town" && isTown && subView === "crafting" && (
            <div className="space-y-3">
              <SubViewHeader title="대장간" onBack={() => setSubView(null)} />
              <CraftingView
                knownIds={crafting.state.known}
                materialCounts={inventory.state.materials}
                onCraft={handleCraft}
              />
            </div>
          )}
          {tab === "town" && isTown && subView === "shop" && (
            <div className="space-y-3">
              <SubViewHeader title="상점" onBack={() => setSubView(null)} />
              <ShopView
                gold={character.gold}
                inventory={inventory.state}
                onPurchasePotion={handlePurchasePotion}
                onPurchaseMaterial={handlePurchaseMaterial}
                onSellPotion={handleSellPotion}
                onSellMaterial={handleSellMaterial}
                onSellEquipment={handleSellEquipment}
              />
            </div>
          )}
          {tab === "town" && isTown && subView === "guild" && (
            <div className="space-y-3">
              <SubViewHeader
                title={`모험가 길드 · ${currentRegion.name}`}
                onBack={() => setSubView(null)}
              />
              <GuildView
                regionId={currentRegion.id}
                characterLevel={character.level}
                getEntry={quests.getEntry}
                onAccept={handleAcceptQuest}
                onClaim={handleClaimQuest}
              />
            </div>
          )}

          {tab === "character" && subView === null && (
            <div className="space-y-2">
              <EntryCard
                icon={
                  <User
                    size={28}
                    weight="duotone"
                    className="text-blue-500"
                  />
                }
                title="내 정보"
                description="캐릭터 정보와 능력치를 확인합니다."
                onClick={() => setSubView("info")}
              />
              <EntryCard
                icon={
                  <Backpack
                    size={28}
                    weight="duotone"
                    className="text-emerald-500"
                  />
                }
                title="가방"
                description="모험에 필요한 물건들을 챙길 수 있는 가방이다."
                onClick={() => setSubView("inventory")}
              />
              <EntryCard
                icon={
                  <Sparkle
                    size={28}
                    weight="duotone"
                    className="text-amber-500"
                  />
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
                  <BookOpen
                    size={28}
                    weight="duotone"
                    className="text-emerald-600"
                  />
                }
                title="모험의 서"
                description="지금까지의 여정과 발견을 기록합니다."
                onClick={() => setSubView("adventure-log")}
              />
              <EntryCard
                icon={
                  <Scroll
                    size={28}
                    weight="duotone"
                    className="text-rose-500"
                  />
                }
                title="최근 기록"
                description={
                  notifications.list.length > 0
                    ? `최근 알림 ${notifications.list.length}개`
                    : "아직 기록된 알림이 없습니다."
                }
                onClick={() => setSubView("recent-log")}
              />
            </div>
          )}
          {tab === "character" && subView === "info" && (
            <div className="space-y-3">
              <SubViewHeader title="내 정보" onBack={() => setSubView(null)} />
              <CharacterMini character={character} />
              <Card as="section" padding="md">
                <div className="space-y-4">
                  <AdventurerCard character={character} />
                  <div className="border-t border-zinc-200 dark:border-zinc-800" />
                  <StatsPanel stats={character.stats} />
                </div>
              </Card>
            </div>
          )}
          {tab === "character" && subView === "inventory" && (
            <div className="space-y-3">
              <SubViewHeader title="가방" onBack={() => setSubView(null)} />
              <InventoryView
                inventory={inventory.state}
                equipped={character.equipped}
                onEquip={handleEquipFromInventory}
              />
            </div>
          )}
          {tab === "character" && subView === "skills" && (
            <div className="space-y-3">
              <SubViewHeader title="스킬" onBack={() => setSubView(null)} />
              <SkillsView skills={character.skills} />
            </div>
          )}
          {tab === "character" && subView === "adventure-log" && (
            <div className="space-y-3">
              <SubViewHeader title="모험의 서" onBack={() => setSubView(null)} />
              <AdventureLogView
                log={adventureLog.log}
                stats={character.stats}
              />
            </div>
          )}
          {tab === "character" && subView === "recent-log" && (
            <div className="space-y-3">
              <SubViewHeader
                title="최근 기록"
                onBack={() => setSubView(null)}
              />
              <RecentLogView
                notifications={notifications.list}
                onClear={notifications.clear}
              />
            </div>
          )}
        </main>
      </div>
      <NotificationToast notifications={notifications.alertable} />
      {showModal && <NameSetupModal onSubmit={profile.submit} />}
    </>
  );
}
