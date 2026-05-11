"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  Coins,
  Envelope,
  MapPin,
  Note,
  Storefront,
  Trophy,
} from "@phosphor-icons/react";
import { SettingsMenu } from "@/components/SettingsMenu";
import { ChatButton } from "@/components/ChatButton";
import { NameSetupModal } from "@/components/NameSetupModal";
import { type BattleEndPayload } from "@/adventure/BattleView";
import { TownScreen } from "@/adventure/TownScreen";
import { CharacterScreen } from "@/adventure/CharacterScreen";
import { AdventureScreen } from "@/adventure/AdventureScreen";
import { GameProvider, type GameCtx } from "@/adventure/GameContext";
import { useAdventureLog } from "@/adventure/log/useAdventureLog";
import { WORLD_MAP, type RegionId } from "@/adventure/data/world";
import {
  initialMapProgress,
  type MapProgress,
} from "@/lib/map-progress";
import { START_REGION_ID } from "@/adventure/data/world";
import {
  CONSUMABLES,
  type ConsumableId,
} from "@/adventure/data/consumables";
import { NotificationBell } from "@/components/NotificationBell";
import { NotificationToast } from "@/components/NotificationToast";
import { LevelUpOverlay } from "@/components/LevelUpOverlay";
import { useQuests } from "@/adventure/quests/useQuests";
import { getQuestById } from "@/adventure/data/quests";
import {
  applyQuestReward,
  type RewardServices,
} from "@/adventure/quests/applyReward";
import { ITEMS, findItemId, rarityTextClass, type EquipSlot, type ItemId } from "@/adventure/data/items";
import {
  getItemSellPrice,
  getMaterialSellPrice,
  getPotionSellPrice,
} from "@/adventure/data/sellPrices";
import {
  POTIONS,
  type PotionId,
} from "@/adventure/data/potions";
import { useInventory } from "@/adventure/inventory/useInventory";
import { MarketplaceTab } from "@/adventure/marketplace/MarketplaceTab";
import { InboxView } from "@/adventure/marketplace/InboxView";
import { useInboxCount } from "@/adventure/marketplace/useInboxCount";
import { RankingsView } from "@/adventure/rankings/RankingsView";
import { useRemoteSave } from "@/lib/storage/SaveProvider";
import { useAutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";
import { type Recipe } from "@/adventure/data/recipes";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { useCrafting } from "@/adventure/crafting/useCrafting";
import { NEWBIE_BONUS_LEVEL_THRESHOLD, isNewbieBonusActive } from "@/lib/leveling";
import { BulletinBoardView } from "@/adventure/BulletinBoardView";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";
import { useNotifications } from "@/adventure/notifications/useNotifications";
import { TabBar } from "@/components/ui/TabBar";
import { EntryCard } from "@/components/ui/EntryCard";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { RegionBackground } from "@/components/ui/RegionBackground";
import { formatDuration } from "@/lib/format";
import { ZERO_ALLOCATED } from "@/adventure/character/statMeta";
import { useTraining } from "@/adventure/training/useTraining";
import { baseCharacter } from "@/adventure/character/defaults";
import { useCharacterState } from "@/adventure/character/useCharacterState";
import { useProfile } from "@/adventure/profile/useProfile";
import { useTrialUnlocks } from "@/adventure/edges/useTrialUnlocks";
import { composeCharacter } from "@/adventure/character/composeCharacter";
import { useTitleGrants } from "@/adventure/character/useTitleGrants";
import { useLevelUpDetection } from "@/adventure/character/useLevelUpDetection";
import { useRespawnSafetyNet } from "@/adventure/character/useRespawnSafetyNet";
import { getTitle } from "@/adventure/data/titles";
import {
  useOfflineSimulation,
  OFFLINE_REWARD_PENDING_KEY,
} from "@/adventure/battle/useOfflineSimulation";
import {
  summarizeOfflineResult,
  OFFLINE_SIM_MAX_MS,
  type OfflineSimResult,
} from "@/adventure/battle/offlineSim";
import { OfflineRewardsModal } from "@/adventure/battle/OfflineRewardsModal";
import { onBattleEnd } from "@/adventure/battle/onBattleEnd";
import { useGuildFameSync } from "@/adventure/guild/useGuildFameSync";
import { useGuildBuffsCache } from "@/adventure/guild/useGuildBuffsCache";
import { reportGuildQuestProgress } from "@/adventure/guild/api";
import { useShopUnlocks } from "@/adventure/shop/useShopUnlocks";
import { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { SaveProvider, useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import { useNavTabs, type TabKey } from "@/lib/useNavTabs";
import { usePresenceHeartbeat } from "@/lib/usePresenceHeartbeat";
import { useHuntingState } from "@/adventure/hunting/useHuntingState";
import { useTrialState } from "@/adventure/trial/useTrialState";

const TABS: { key: TabKey; label: string }[] = [
  { key: "adventure", label: "모험" },
  { key: "town", label: "마을" },
  { key: "character", label: "캐릭터" },
  { key: "plaza", label: "광장" },
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

export default function Page() {
  return (
    <SaveProvider>
      <Suspense fallback={null}>
        <Home />
      </Suspense>
    </SaveProvider>
  );
}

function Home() {
  // tab/subView 는 URL 쿼리(?tab=...&sub=...)로 관리 → 브라우저 back/forward 가 in-app 이동을 따라감.
  const {
    tab,
    subView,
    setTab,
    setSubView,
    replaceSubView,
    replaceLocation,
    back,
  } = useNavTabs();

  const hunting = useHuntingState();
  const trial = useTrialState({ tab, subView });

  // 마을 진입 직후 자동으로 열 NPC 대화 — 알림판 클릭 시 세팅, TownView 가 마운트 직후 소비.
  const [pendingTownNpcId, setPendingTownNpcId] = useState<string | null>(null);
  // 자동 사냥 중 탭/앱이 백그라운드 → 복귀 시 누적 보상 모달.
  // 한 번에 하나만 표시 — 새 결과가 들어오면 직전 것을 덮어쓴다.
  const [offlineRewards, setOfflineRewards] = useState<OfflineSimResult | null>(
    null,
  );

  const initialMap = useSavedValue<Partial<MapProgress>>("map.v2");
  const [mapProgress, setMapProgress] = useState<MapProgress>(() => ({
    currentRegionId: initialMap?.currentRegionId ?? initialMapProgress.currentRegionId,
    visitedRegionIds:
      initialMap?.visitedRegionIds && initialMap.visitedRegionIds.length > 0
        ? initialMap.visitedRegionIds
        : initialMapProgress.visitedRegionIds,
    respawnRegionId:
      initialMap?.respawnRegionId ?? initialMapProgress.respawnRegionId,
  }));
  useRemotePatch("map.v2", mapProgress);
  const adventureLog = useAdventureLog();
  const quests = useQuests();
  const crafting = useCrafting();
  const inventory = useInventory();
  const remote = useRemoteSave();
  const inbox = useInboxCount();
  const autoPotion = useAutoPotionConfig();
  const training = useTraining();
  const characterStateHook = useCharacterState();
  const characterState = characterStateHook.state;
  const profile = useProfile();
  const notifications = useNotifications();
  const trialUnlocks = useTrialUnlocks();
  const storyFlags = useStoryFlags();
  const shopUnlocks = useShopUnlocks();

  // 마을 탭에 있는데 현재 위치가 마을이 아니면 서브뷰 강제 종료
  useEffect(() => {
    const currentTags = WORLD_MAP.regions.find(
      (r) => r.id === mapProgress.currentRegionId,
    )?.tags;
    const inTown = currentTags?.includes("town") ?? false;
    if (tab === "town" && !inTown) {
      replaceSubView(null);
    }
    // replaceSubView 는 router 의 안정 참조 — deps 에서 제외해도 안전.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mapProgress.currentRegionId]);

  // setTab 은 항상 sub 를 비우므로 추가 처리 없음.
  const handleTabChange = setTab;

  const trainingDescription = training.isTraining
    ? `훈련 중 · ${formatDuration(training.remaining)}`
    : training.unspentPoints > 0
      ? `단련 포인트 ${training.unspentPoints}개 보유`
      : "능력치를 단련할 수 있는 곳.";

  // 전투 전적 = 누적 처치 + 누적 패배. 도주 경로가 없어 둘의 합이 곧 전투 횟수.
  const totalMonsterKills = Object.values(adventureLog.log.monsters).reduce(
    (sum, m) => sum + (m.kills ?? 0),
    0,
  );
  const battleCount =
    totalMonsterKills + (adventureLog.log.battleLosses ?? 0);

  const equippedTitle = getTitle(characterStateHook.equippedTitleId);

  // 스탯/장비/스킬/HP 합산 → PlayerCombat + Character 단일 source-of-truth.
  // derivePlayerCombat 을 내부에서 호출 — 서버 협동 보스도 같은 함수로 재현해 클라이언트
  // 위변조 차단. 변경 시 derivePlayerCombat.ts 의 스탯 변환 규칙과 동기화 필수.
  const composed = composeCharacter({
    level: characterState.level,
    baseStats: baseCharacter.stats,
    allocatedStats: training.allocatedStats ?? ZERO_ALLOCATED,
    equipped: characterStateHook.equippedSlots,
    equippedSkills: characterState.equippedSkills,
    hp: characterState.hp,
    mp: characterState.mp,
    name: profile.name,
    gender: profile.gender,
    exp: characterState.exp,
    gold: characterState.gold,
    fame: characterState.fame,
    battleCount,
    titleName: equippedTitle?.name,
    affiliation:
      characterStateHook.state.affiliation ?? baseCharacter.affiliation,
  });
  const {
    character,
    player: playerCombat,
    totalStats,
    effectiveSkillNames: effectiveSkillNameList,
    characterSkills,
  } = composed;

  usePresenceHeartbeat({
    name: character.name,
    className: character.className,
    title: character.titleName ?? null,
  });
  useGuildFameSync(character.fame);
  const guildBuffsCache = useGuildBuffsCache();

  const showModal = profile.needsSetup;
  const currentRegion =
    WORLD_MAP.regions.find((r) => r.id === mapProgress.currentRegionId) ??
    WORLD_MAP.regions[0];
  const isTown = currentRegion.tags?.includes("town") ?? false;

  useEffect(() => {
    adventureLog.markRegionVisited(currentRegion.id);
  }, [currentRegion.id, adventureLog]);

  // HP<=0 인데 마을이 아닌 곳에 stuck 된 유저를 다음 진입 때 복귀 마을로 강제 이동.
  useRespawnSafetyNet({
    hp: characterState.hp,
    isTown,
    mapProgress,
    setMapProgress,
    setHp: characterStateHook.setHp,
    setHuntingActive: hunting.setActive,
    replaceSubView,
  });

  const playerStatus = {
    gender: character.gender,
    mp: character.mp,
    maxMp: character.maxMp,
    exp: character.exp,
    maxExp: character.maxExp,
  };

  const handlePurchasePotion = (id: PotionId, quantity: number) => {
    const potion = POTIONS[id];
    if (!potion) return;
    const have = inventory.state.potions[id] ?? 0;
    const room = Math.max(0, inventory.potionMax - have);
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

  const handlePurchaseConsumable = (id: ConsumableId, quantity: number) => {
    const c = CONSUMABLES[id];
    if (!c || quantity <= 0) return;
    const cost = c.price * quantity;
    if (characterState.gold < cost) return;
    characterStateHook.addGold(-cost);
    inventory.addConsumable(id, quantity);
  };

  const addNotification = (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => notifications.add(kind, text, meta);

  // 마을 귀환 주문서 사용 — 가본 마을로 즉시 이동.
  // 마을→마을은 무소비 (지도 fast-travel 과 동일), 그 외엔 1개 소비.
  const handleUseTownReturn = (townId: RegionId): boolean => {
    const target = WORLD_MAP.regions.find((r) => r.id === townId);
    if (!target?.tags?.includes("town")) return false;
    if (!mapProgress.visitedRegionIds.includes(townId)) return false;
    if (mapProgress.currentRegionId === townId) return false;
    const from = WORLD_MAP.regions.find(
      (r) => r.id === mapProgress.currentRegionId,
    );
    const fromIsTown = !!from?.tags?.includes("town");
    if (!fromIsTown) {
      if (!inventory.consumeConsumable("scroll_town_return", 1)) return false;
    }
    setMapProgress((prev) => ({ ...prev, currentRegionId: townId }));
    addNotification(
      "info",
      fromIsTown
        ? `${target.name}(으)로 이동했다.`
        : `귀환 주문서로 ${target.name}(으)로 이동했다.`,
    );
    return true;
  };

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
    // 누적 판매량 100 도달 시 상점에서 구매 가능. 처음 도달한 순간만 알림.
    // 임계치를 처음 넘긴 시점에 '상인' 칭호도 함께 부여 (이미 보유면 idempotent).
    const crossed = shopUnlocks.recordSale(id, quantity);
    if (crossed) {
      addNotification(
        "info",
        `상점에서 ${MATERIALS[id].name}을(를) 취급하기 시작했다.`,
      );
      grantTitle("merchant");
    }
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
    if (id === "mom_amulet") grantTitle("unfilial");
  };

  // 마운트 1회 — 신참 보너스 활성 안내, 시련 이어서 진행 안내, reload 사유 안내.
  // 모두 한 번만 보여줘야 하므로 ref 가드 + 보여준 뒤 localStorage 플래그 정리.
  const oneTimeNoticesShownRef = useRef(false);
  useEffect(() => {
    if (oneTimeNoticesShownRef.current) return;
    oneTimeNoticesShownRef.current = true;
    if (isNewbieBonusActive(characterState.level)) {
      addNotification(
        "info",
        `신참 보너스 활성 — ${NEWBIE_BONUS_LEVEL_THRESHOLD}레벨 미만 동안 사냥/퀘스트 EXP ×2.`,
      );
    }
    // 시련 재개 안내 — 사용자가 실제 시련 화면(adventure/map) 으로 들어왔을 때만.
    //   - winCount < battles : 임계 도달은 TrialView mount 가 곧 자동 완료 처리 → 안내 불필요.
    //   - sessionStorage dedup by winCount : 60초 hidden→reload 가 반복돼도 같은
    //     winCount 면 1회만 발화. 탭 종료/새 시련 시작 시 endTrial 에서 자동 클리어.
    if (
      tab === "adventure" &&
      subView === "map" &&
      trial.trial &&
      trial.winCount > 0 &&
      trial.winCount < trial.trial.edge.battles
    ) {
      let lastShown = -1;
      try {
        const v = sessionStorage.getItem("trial-resume-shown.v1");
        if (v !== null) lastShown = Number(v);
      } catch {}
      if (lastShown !== trial.winCount) {
        addNotification(
          "info",
          `시련 이어서 진행 — ${trial.winCount} / ${trial.trial.edge.battles}.`,
        );
        try {
          sessionStorage.setItem(
            "trial-resume-shown.v1",
            String(trial.winCount),
          );
        } catch {}
      }
    }
    if (typeof window !== "undefined") {
      try {
        const reason = localStorage.getItem("pending-reload-toast.v1");
        if (reason) {
          localStorage.removeItem("pending-reload-toast.v1");
          addNotification("info", reason);
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 레벨업/스킬 획득 감지 → 알림 + 오버레이 트리거.
  const { levelUpTrigger } = useLevelUpDetection({
    level: characterState.level,
    characterSkills,
    addPoints: training.addPoints,
    addNotification: (kind, text) => addNotification(kind, text),
  });

  // 인벤토리에서 장비를 꺼내 장착. 보유분에서 1개 차감, 기존 장비는 회수.
  const handleEquipFromInventory = (id: ItemId) => {
    if (!inventory.consumeEquipment(id, 1)) return;
    const item = ITEMS[id];
    const oldId = findItemId(characterStateHook.equippedSlots[item.slot]);
    if (oldId) inventory.addEquipment(oldId, 1);
    characterStateHook.setSlot(item.slot, item);
    addNotification("info", `${item.name}을(를) 장착했다.`, {
      highlight: { name: item.name, className: rarityTextClass(item) },
    });
  };

  const handleUnequip = (slot: EquipSlot) => {
    const current = characterStateHook.equippedSlots[slot];
    if (!current) return;
    const id = findItemId(current);
    if (id) inventory.addEquipment(id, 1);
    characterStateHook.setSlot(slot, null);
    addNotification("info", `${current.name}을(를) 해제했다.`, {
      highlight: { name: current.name, className: rarityTextClass(current) },
    });
  };

  const handleCraft = (recipe: Recipe) => {
    // 재료 검사 — 부족하면 알림만 띄우고 중단.
    for (const ing of recipe.ingredients) {
      if (ing.kind === "material") {
        if (inventory.materialCount(ing.materialId) < ing.count) {
          const name = MATERIALS[ing.materialId].name;
          addNotification(
            "info",
            `재료가 부족하다 — ${name} ${ing.count}개 필요.`,
          );
          return;
        }
      } else {
        const have = inventory.state.equipment[ing.itemId] ?? 0;
        if (have < ing.count) {
          const name = ITEMS[ing.itemId].name;
          addNotification(
            "info",
            `재료가 부족하다 — ${name} ${ing.count}개 필요.`,
          );
          return;
        }
      }
    }
    // 포션 결과는 종류별 한도(potionMax) 검사 — 가득 차 있으면 재료만
    // 소비되고 결과물이 안 늘어나는 버그를 막기 위해 사전 차단.
    if (recipe.result.kind === "potion") {
      const have = inventory.state.potions[recipe.result.potionId] ?? 0;
      if (have >= inventory.potionMax) {
        const potion = POTIONS[recipe.result.potionId];
        addNotification("info", `${potion.name}을(를) 더 들 수 없다.`);
        return;
      }
    }
    // 차감.
    for (const ing of recipe.ingredients) {
      if (ing.kind === "material") {
        inventory.consumeMaterial(ing.materialId, ing.count);
      } else {
        inventory.consumeEquipment(ing.itemId, ing.count);
      }
    }
    crafting.markCrafted(recipe.id);

    if (recipe.result.kind === "equipment") {
      const item = ITEMS[recipe.result.itemId];
      inventory.addEquipment(recipe.result.itemId);
      addNotification("info", `${item.name}을(를) 만들었다.`, {
        highlight: { name: item.name, className: rarityTextClass(item) },
      });
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

  // 칭호 등록은 "획득 시"가 트리거 — 신규로 등록되는 시점에만 토스트.
  // 이미 획득한 칭호엔 무반응 (markTitleObtained 자체가 idempotent).
  const grantTitle = (titleId: string) => {
    if (adventureLog.log.titles[titleId]) return;
    adventureLog.markTitleObtained(titleId);
    const title = getTitle(titleId);
    if (title) addNotification("info", `칭호 획득 — ${title.name}`);
  };

  // 카운터/상태/시간 기반 자동 칭호 부여.
  const maxNpcTalkCount = Object.values(adventureLog.log.npcs).reduce(
    (max, e) => Math.max(max, e?.talkCount ?? 0),
    0,
  );
  useTitleGrants(grantTitle, {
    battleLosses: adventureLog.log.battleLosses ?? 0,
    trainingCount: training.completedCount,
    chatCount: adventureLog.log.chatCount ?? 0,
    healingCount: adventureLog.log.healingCount ?? 0,
    gold: characterState.gold,
    level: characterState.level,
    maxNpcTalkCount,
    totalStats,
  });

  const handleBattleEnd = (payload: BattleEndPayload) =>
    onBattleEnd(payload, {
      inventory: {
        consume: inventory.consume,
        addMaterial: inventory.addMaterial,
        addEquipment: inventory.addEquipment,
      },
      adventureLog: {
        addKill: adventureLog.addKill,
        markTitleObtained: grantTitle,
        incrementBattleLosses: adventureLog.incrementBattleLosses,
      },
      quests: { recordKill: quests.recordKill },
      crafting: {
        knows: crafting.knows,
        learnRecipe: crafting.learnRecipe,
      },
      characterState: {
        setHp: characterStateHook.setHp,
        addExp: characterStateHook.addExp,
        addGoldFame: characterStateHook.addGoldFame,
      },
      storyFlags: { set: storyFlags.set },
      vit: character.stats.vit,
      luk: character.stats.luk,
      respawnRegionId: mapProgress.respawnRegionId ?? START_REGION_ID,
      addNotification,
      setHuntingActive: hunting.setActive,
      replaceLocation,
      setMapProgress,
      reportGuildKill: (enemyName) => {
        void reportGuildQuestProgress({
          kind: "kill_monster",
          name: enemyName,
          count: 1,
        }).catch(() => {});
      },
      guildBuffs: guildBuffsCache.buffs,
    });

  const handleAcceptQuest = (id: string) => {
    quests.accept(id);
  };

  // 오프라인 자동 사냥 — 서버 권위 모델.
  // 토글 ON / 복귀 / OFF 시점에 /api/offline-hunt/{start,claim,end} 호출.
  // 서버가 sim + 보상 적용 + baseline 갱신을 트랜잭션 안에서 처리.
  // 결과가 있으면 sessionStorage 박고 reload → 아래 mount-time handler 가 모달.
  const { flushNow: flushOfflineSim } = useOfflineSimulation({
    enabled: currentRegion.enemies.length > 0,
    active: hunting.active,
    isInBattleView: tab === "adventure" && subView === "battle",
    regionId: currentRegion.id,
    playerName: profile.name,
    getAutoPotionRules: () => autoPotion.config.rules,
  });
  // ref bridging — useHuntingState 의 setActive 가 OFF 전이 시 flushOfflineSim 을 호출.
  hunting.setFlushHandler(flushOfflineSim);

  // 마운트 시 sessionStorage 에 reload 직전 박힌 결과가 있으면 모달로 표시.
  // 사망의 경우 useHuntingState 가 sessionStorage "hunting-active"="false" 에서 OFF 복원.
  // 부가 알림/title/quest 진행도 함께 처리.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(OFFLINE_REWARD_PENDING_KEY);
      if (raw) sessionStorage.removeItem(OFFLINE_REWARD_PENDING_KEY);
    } catch {}
    if (!raw) return;
    let result: OfflineSimResult;
    try {
      result = JSON.parse(raw) as OfflineSimResult;
    } catch {
      return;
    }
    // 도감/퀘스트 진행 — 서버는 character/inventory 만 갱신했고 클라 도감 (adventureLog.v2)
    // 과 quest-progress.v2 는 별도 키. 사망 후 reload 직후라 server-state 가 클라 hooks 로
    // hydrate 된 상태에서 추가 누적 가능.
    const readyQuestIds = new Set<string>();
    let anyKill = false;
    for (const [name, n] of Object.entries(result.killsByName)) {
      for (let i = 0; i < n; i += 1) {
        adventureLog.addKill(name);
        for (const id of quests.recordKill(name)) readyQuestIds.add(id);
        anyKill = true;
      }
    }
    if (anyKill) grantTitle("first_blood");
    if (result.died) {
      adventureLog.incrementBattleLosses();
      replaceLocation("town", "healing");
    }
    const summary = summarizeOfflineResult(result);
    const minutes = Math.max(1, Math.round(result.simulatedMs / 60_000));
    const cap =
      result.cappedByLimit && result.simulatedMs >= OFFLINE_SIM_MAX_MS
        ? ` (${OFFLINE_SIM_MAX_MS / 3_600_000}시간 cap)`
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
    setOfflineRewards(result);
    // 빈 deps — 마운트 1회만. addNotification/quests/adventureLog 등은 hook 들의 stable wrapper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rewardServices: RewardServices = {
    addPotion: (id, n) => inventory.add(id, n),
    addMaterial: (id, n) => inventory.addMaterial(id, n),
    addEquipment: (id) => inventory.addEquipment(id),
    learnRecipe: (id) => crafting.learnRecipe(id),
    addGoldFame: characterStateHook.addGoldFame,
    // 퀘스트 보상으로 레벨업 시에도 VIT 보너스만큼 maxHp 까지 풀회복.
    addExp: (n) => characterStateHook.addExp(n, character.stats.vit),
    addPotionCapacity: (n) => inventory.addPotionCapacity(n),
  };

  // 퀘스트 보상 지급 + 알림 한 줄로 합성. NPC 다이얼로그/길드 게시판 공용.
  const completeQuest = (id: string): boolean => {
    const result = quests.claim(id);
    if (!result.ok) return false;
    const tokens = applyQuestReward(result.quest.reward, rewardServices, {
      playerLevel: character.level,
      guildBuffs: guildBuffsCache.buffs,
    });
    addNotification(
      "quest_complete",
      tokens.length > 0
        ? `${result.quest.title} 완료 — ${tokens.join(", ")}`
        : `${result.quest.title} 완료`,
    );
    // 마린의 영혼 결정 의뢰 = "안개 너머의 길" 라인의 클로저 → 칭호 부여.
    if (id === "diola-marin-soul-crystals") grantTitle("diola_friend");
    return true;
  };

  const handleClaimQuest = (id: string) => {
    completeQuest(id);
  };

  const gameCtx: GameCtx = {
    inventory,
    characterStateHook,
    training,
    crafting,
    quests,
    adventureLog,
    notifications,
    trialUnlocks,
    storyFlags,
    shopUnlocks,
    autoPotion,
    remote,
    inbox,
    profile,
    character,
    currentRegion,
    isTown,
    effectiveSkillNameList,
    trainingDescription,
    playerCombat,
    playerStatus,
    mapProgress,
    setMapProgress,
    pendingTownNpcId,
    setPendingTownNpcId,
    trialEdge: trial.edge,
    trialWinCount: trial.winCount,
    startTrial: trial.start,
    endTrial: trial.end,
    recordTrialWin: trial.recordWin,
    huntingActive: hunting.active,
    setHuntingActive: hunting.setActive,
    guildBuffs: guildBuffsCache.buffs,
    refreshGuildBuffs: guildBuffsCache.refresh,
    tab,
    subView,
    setSubView,
    back,
    addNotification,
    grantTitle,
    handlePurchasePotion,
    handlePurchaseMaterial,
    handlePurchaseConsumable,
    handleUseTownReturn,
    handleSellPotion,
    handleSellMaterial,
    handleSellEquipment,
    handleEquipFromInventory,
    handleUnequip,
    handleCraft,
    handleBattleEnd,
    handleAcceptQuest,
    handleClaimQuest,
    completeQuest,
  };

  return (
    <GameProvider value={gameCtx}>
      <RegionBackground regionId={currentRegion.id} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 py-3 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("adventure")}
              className="inline-flex items-center gap-1 truncate rounded-md text-base font-semibold text-zinc-700 transition-colors hover:text-emerald-600 dark:text-zinc-200 dark:hover:text-emerald-400"
            >
              <MapPin size={16} weight="fill" className="text-emerald-500" />
              {currentRegion.name}
            </button>
            {hunting.active && currentRegion.enemies.length > 0 && (
              <span
                title="자동 사냥 ON"
                aria-label="자동 사냥 진행 중"
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
              >
                <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                사냥
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-zinc-700 dark:text-zinc-200">
              <Coins size={20} weight="fill" className="text-yellow-500" />
              {character.gold.toLocaleString()}
            </span>
            <NotificationBell
              notifications={notifications.list}
              unreadCount={notifications.unreadCount}
              onOpen={notifications.markRead}
            />
            <ChatButton
              name={character.name}
              className={character.className}
              title={character.titleName ?? null}
              onSent={adventureLog.incrementChatCount}
            />
            <SettingsMenu />
          </div>
        </header>

        <MainTabs active={tab} onChange={handleTabChange} />

        <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6">
          {tab === "adventure" && <AdventureScreen />}
          {tab === "town" && <TownScreen />}
          {tab === "character" && <CharacterScreen />}
          {tab === "plaza" && subView === null && (
            <div className="space-y-2">
              <EntryCard
                icon={
                  <Storefront
                    size={28}
                    weight="duotone"
                    className="text-emerald-500"
                  />
                }
                title="거래소"
                description="다른 모험가와 아이템을 사고팔 수 있는 곳."
                onClick={() => setSubView("marketplace")}
              />
              <EntryCard
                icon={
                  <Note
                    size={28}
                    weight="duotone"
                    className="text-sky-500"
                  />
                }
                title="게시판"
                description="마을의 새 소식이 올라오는 곳."
                onClick={() => setSubView("bulletin")}
              />
              <EntryCard
                icon={
                  <Envelope
                    size={28}
                    weight="duotone"
                    className="text-amber-500"
                  />
                }
                title={
                  inbox.count !== null && inbox.count > 0
                    ? `우편함 (${inbox.count})`
                    : "우편함"
                }
                description={
                  inbox.count !== null && inbox.count > 0
                    ? "거래소에서 도착한 우편이 있습니다."
                    : "거래소 거래 결과가 도착하는 곳."
                }
                onClick={() => setSubView("inbox")}
              />
              <EntryCard
                icon={
                  <Trophy
                    size={28}
                    weight="duotone"
                    className="text-amber-600"
                  />
                }
                title="랭킹"
                description="모험가 명부 — 등록한 사람들의 레벨, 명성, 전투 횟수 순위."
                onClick={() => setSubView("rankings")}
              />
            </div>
          )}
          {tab === "plaza" && subView === "bulletin" && (
            <div className="space-y-3">
              <SubViewHeader title="게시판" onBack={back} />
              <BulletinBoardView
                name={character.name}
                className={character.className}
                title={equippedTitle?.name ?? null}
              />
            </div>
          )}
          {tab === "plaza" && subView === "marketplace" && (
            <div className="space-y-3">
              <SubViewHeader title="거래소" onBack={back} />
              <MarketplaceTab />
            </div>
          )}
          {tab === "plaza" && subView === "inbox" && (
            <div className="space-y-3">
              <SubViewHeader title="우편함" onBack={back} />
              <InboxView />
            </div>
          )}
          {tab === "plaza" && subView === "rankings" && (
            <div className="space-y-3">
              <SubViewHeader title="랭킹" onBack={back} />
              <RankingsView />
            </div>
          )}
        </main>
      </div>
      <NotificationToast notifications={notifications.list} />
      <LevelUpOverlay level={character.level} triggerKey={levelUpTrigger} />
      {showModal && <NameSetupModal onSubmit={profile.submit} />}
      {offlineRewards && (
        <OfflineRewardsModal
          result={offlineRewards}
          onClose={() => setOfflineRewards(null)}
        />
      )}
    </GameProvider>
  );
}
