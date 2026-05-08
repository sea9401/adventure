"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  Backpack,
  Barbell,
  BookOpen,
  Coins,
  Compass,
  Envelope,
  FirstAid,
  Hammer,
  MapPin,
  Note,
  Scroll,
  Sparkle,
  Storefront,
  Sword,
  User,
} from "@phosphor-icons/react";
import { SettingsMenu } from "@/components/SettingsMenu";
import { ChatButton } from "@/components/ChatButton";
import { NameSetupModal } from "@/components/NameSetupModal";
import { MapView } from "@/adventure/MapView";
import { BattleView, type BattleEndPayload } from "@/adventure/BattleView";
import { TownView } from "@/adventure/TownView";
import { AdventureLogView } from "@/adventure/AdventureLogView";
import { useAdventureLog } from "@/adventure/log/useAdventureLog";
import { WORLD_MAP } from "@/adventure/data/world";
import {
  initialMapProgress,
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
import { ITEMS, findItemId, type EquipSlot, type ItemId } from "@/adventure/data/items";
import {
  getItemSellPrice,
  getMaterialSellPrice,
  getPotionSellPrice,
} from "@/adventure/data/sellPrices";
import {
  POTIONS,
  POTION_MAX_PER_TYPE,
  type PotionId,
} from "@/adventure/data/potions";
import { useInventory } from "@/adventure/inventory/useInventory";
import { MarketplaceTab } from "@/adventure/marketplace/MarketplaceTab";
import { InboxView } from "@/adventure/marketplace/InboxView";
import { useInboxCount } from "@/adventure/marketplace/useInboxCount";
import { useRemoteSave } from "@/lib/storage/SaveProvider";
import { useAutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";
import { InventoryView } from "@/adventure/InventoryView";
import { ShopView } from "@/adventure/ShopView";
import { type Recipe } from "@/adventure/data/recipes";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { useCrafting } from "@/adventure/crafting/useCrafting";
import { requiredExpToNext } from "@/lib/leveling";
import { CraftingView } from "@/adventure/CraftingView";
import { BulletinBoardView } from "@/adventure/BulletinBoardView";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";
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
import { useEdgeUnlocks } from "@/adventure/edges/useEdgeUnlocks";
import {
  TrialView,
  type TrialEdge,
} from "@/adventure/TrialView";
import { findEdgeRequirement } from "@/adventure/data/edge-requirement";
import {
  deriveSkills,
  powerAttackBonusFor,
} from "@/adventure/character/skills";
import { getTitle } from "@/adventure/data/titles";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { useOfflineSimulation } from "@/adventure/battle/useOfflineSimulation";
import {
  simulateOfflineHunt,
  summarizeOfflineResult,
  OFFLINE_SIM_MAX_MS,
} from "@/adventure/battle/offlineSim";
import { PLAYER_TURN_INTERVAL_MS } from "@/adventure/battle/useBattle";
import { onBattleEnd } from "@/adventure/battle/onBattleEnd";
import { TrainerDialogue } from "@/adventure/town/dialogues/TrainerDialogue";
import { BlacksmithDialogue } from "@/adventure/town/dialogues/BlacksmithDialogue";
import { SuzyDialogue } from "@/adventure/town/dialogues/SuzyDialogue";
import { KaiDialogue } from "@/adventure/town/dialogues/KaiDialogue";
import { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { SaveProvider, useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import { useNavTabs, type TabKey } from "@/lib/useNavTabs";
import { usePresenceHeartbeat } from "@/lib/usePresenceHeartbeat";

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
  // 자동 사냥 ON/OFF. 디폴트 ON — 새 탭/창에서도 ON 으로 시작.
  // region 이동/사망 시 false 로 떨어지고, 같은 탭 안에서는 sessionStorage 로 보존.
  // sessionStorage 가 명시적으로 "false" 일 때만 OFF 로 복원 (그 외엔 ON).
  const [huntingActive, setHuntingActiveState] = useState(true);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("hunting-active") === "false") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHuntingActiveState(false);
      }
    } catch {}
  }, []);
  const setHuntingActive = (next: boolean) => {
    setHuntingActiveState(next);
    try {
      sessionStorage.setItem("hunting-active", next ? "true" : "false");
    } catch {}
  };
  // 마을 진입 직후 자동으로 열 NPC 대화 — 알림판 클릭 시 세팅, TownView 가 마운트 직후 소비.
  const [pendingTownNpcId, setPendingTownNpcId] = useState<string | null>(null);
  // 시련(trial) 진행 중인 엣지. 세팅되면 지도 서브뷰에서 TrialView 가 대신 렌더링됨.
  const [trialEdge, setTrialEdge] = useState<TrialEdge | null>(null);
  const initialMap = useSavedValue<Partial<MapProgress>>("map.v2");
  const [mapProgress, setMapProgress] = useState<MapProgress>(() => ({
    currentRegionId: initialMap?.currentRegionId ?? initialMapProgress.currentRegionId,
    visitedRegionIds:
      initialMap?.visitedRegionIds && initialMap.visitedRegionIds.length > 0
        ? initialMap.visitedRegionIds
        : initialMapProgress.visitedRegionIds,
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
  const edgeUnlocks = useEdgeUnlocks();
  const storyFlags = useStoryFlags();

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

  // 시련 중 사용자가 다른 탭/서브뷰로 이동하면 시련 자동 취소.
  // 다시 돌아오면 처음부터 새로 도전. (도중 EXP/킬은 이미 적용됐으므로 손해 없음.)
  useEffect(() => {
    if (!trialEdge) return;
    if (tab !== "adventure" || subView !== "map") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrialEdge(null);
    }
  }, [tab, subView, trialEdge]);

  // region 변경 시 자동 사냥 해제 — 다른 곳으로 이동했으면 그 region에서의 자동 사냥은 끝.
  // 첫 mount(baseline 기록) 시에는 변경 감지하지 않도록 ref로 분기.
  const lastRegionForHuntRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastRegionForHuntRef.current === null) {
      lastRegionForHuntRef.current = mapProgress.currentRegionId;
      return;
    }
    if (lastRegionForHuntRef.current !== mapProgress.currentRegionId) {
      setHuntingActive(false);
      lastRegionForHuntRef.current = mapProgress.currentRegionId;
    }
  }, [mapProgress.currentRegionId]);

  // setTab 은 항상 sub 를 비우므로 추가 처리 없음.
  const handleTabChange = setTab;

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

  const totalStats = STAT_KEYS.reduce<Record<StatKey, number>>(
    (acc, k) => {
      acc[k] =
        baseCharacter.stats[k] + training.allocatedStats[k] + equipStatBonuses[k];
      return acc;
    },
    {} as Record<StatKey, number>,
  );
  // VIT 1pt 당 maxHp +1 — 레벨 기준 max 위에 스탯 보너스를 얹는다.
  const characterMaxHp = maxHpForLevel(characterState.level) + totalStats.vit;
  const characterMaxMp = maxMpForLevel(characterState.level);
  const equippedTitle = getTitle(characterStateHook.equippedTitleId);
  const characterSkills = deriveSkills(totalStats);
  const character: Character = {
    ...baseCharacter,
    name: profile.name,
    gender: profile.gender,
    titleName: equippedTitle?.name,
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
    stats: totalStats,
    skills: characterSkills,
  };
  usePresenceHeartbeat({
    name: character.name,
    className: character.className,
    title: character.titleName ?? null,
  });

  const showModal = profile.needsSetup;
  const currentRegion =
    WORLD_MAP.regions.find((r) => r.id === mapProgress.currentRegionId) ??
    WORLD_MAP.regions[0];
  const isTown = currentRegion.tags?.includes("town") ?? false;

  useEffect(() => {
    adventureLog.markRegionVisited(currentRegion.id);
  }, [currentRegion.id, adventureLog]);

  // 안전망 — HP<=0 인데 마을이 아닌 곳(사냥 지역 등)에 있으면 시작 마을로 강제 복귀.
  // 패배 모달을 확인하기 전에 새로고침/탭 닫기 등으로 빠져나가 stuck 된 유저를 다음 진입에서 구출.
  // 외부 상태(hp/region)를 관찰해 위치 보정 — 의도적 set-state-in-effect.
  useEffect(() => {
    if (characterState.hp > 0) return;
    if (isTown) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMapProgress((prev) => ({
      currentRegionId: START_REGION_ID,
      visitedRegionIds: prev.visitedRegionIds.includes(START_REGION_ID)
        ? prev.visitedRegionIds
        : [...prev.visitedRegionIds, START_REGION_ID],
    }));
    replaceSubView(null);
    // setMapProgress/replaceSubView 안정 참조 — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterState.hp, isTown]);

  const lastSeenLevelRef = useRef<number | null>(null);
  const lastSeenSkillsRef = useRef<string[] | null>(null);

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
  //   민첩 DEX : +1% 회피 / pt, +1 atk / 5pt
  //   활력 VIT : +2 def / pt, +1 maxHp / pt (maxHp는 character 빌드 단계에서 반영)
  //   속도 SPD : 10pt 당 공격 횟수 +1 (베이스 1회)
  //   행운 LUK : +1% 드랍률 / pt (드랍 시스템 도입 시 사용)
  const playerCombat = {
    hp: character.hp,
    maxHp: character.maxHp,
    atk: character.stats.str + Math.floor(character.stats.dex / 5) + equipAtk,
    def: character.stats.vit * 2 + equipDef,
    spd: character.stats.spd,
    evasionPct: character.stats.dex,
    attackCount: 1 + Math.floor(character.stats.spd / 10),
    powerAttackBonus: powerAttackBonusFor(character.stats),
  };

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

  const addNotification = (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => notifications.add(kind, text, meta);

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
  // SaveProvider 가 마운트 전에 character.v1 을 hydrate 하므로 첫 effect 의
  // characterState.level 은 이미 저장된 값. ref 로 베이스라인만 잡고,
  // 이후 증가분만 레벨업으로 처리.
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

  // 스킬 획득 감지 — 스탯 변화로 새 스킬이 추가되면 알림.
  // 마운트 시 현재 보유 스킬을 baseline 으로 잡고, 이후 신규 추가만 알림.
  useEffect(() => {
    const currentNames = characterSkills.map((s) => s.name);
    if (lastSeenSkillsRef.current === null) {
      lastSeenSkillsRef.current = currentNames;
      return;
    }
    const prev = new Set(lastSeenSkillsRef.current);
    for (const name of currentNames) {
      if (!prev.has(name)) {
        addNotification("info", `스킬 획득! ${name}`);
      }
    }
    lastSeenSkillsRef.current = currentNames;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterSkills.map((s) => s.name).join(",")]);

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

  const handleUnequip = (slot: EquipSlot) => {
    const current = characterStateHook.equippedSlots[slot];
    if (!current) return;
    const id = findItemId(current);
    if (id) inventory.addEquipment(id, 1);
    characterStateHook.setSlot(slot, null);
    addNotification("info", `${current.name}을(를) 해제했다.`);
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
    // 포션 결과는 종류별 한도(POTION_MAX_PER_TYPE) 검사 — 가득 차 있으면 재료만
    // 소비되고 결과물이 안 늘어나는 버그를 막기 위해 사전 차단.
    if (recipe.result.kind === "potion") {
      const have = inventory.state.potions[recipe.result.potionId] ?? 0;
      if (have >= POTION_MAX_PER_TYPE) {
        const potion = POTIONS[recipe.result.potionId];
        addNotification("info", `${potion.name}을(를) 더 들 수 없다.`);
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

  // 칭호 등록은 "획득 시"가 트리거 — 신규로 등록되는 시점에만 토스트.
  // 이미 획득한 칭호엔 무반응 (markTitleObtained 자체가 idempotent).
  const grantTitle = (titleId: string) => {
    if (adventureLog.log.titles[titleId]) return;
    adventureLog.markTitleObtained(titleId);
    const title = getTitle(titleId);
    if (title) addNotification("info", `칭호 획득 — ${title.name}`);
  };

  // 누적 패배 카운트가 임계 도달하면 약골 칭호 자동 등록.
  // 외부 상태(battleLosses)를 관찰해 칭호 등록 — 의도적 set-state-in-effect.
  const battleLosses = adventureLog.log.battleLosses ?? 0;
  useEffect(() => {
    if (battleLosses >= 10) grantTitle("frail");
    // grantTitle 안정 참조 — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleLosses]);

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
      characterState: {
        setHp: characterStateHook.setHp,
        addExp: characterStateHook.addExp,
        addGoldFame: characterStateHook.addGoldFame,
      },
      vit: character.stats.vit,
      addNotification,
      setHuntingActive,
      replaceLocation,
      setMapProgress,
    });

  const handleAcceptQuest = (id: string) => {
    quests.accept(id);
  };

  // 오프라인 자동 사냥 — 페이지를 떠난 동안 일어났을 일을 결정적으로 한 번에 시뮬.
  // 30분 cap + 사망 시 break + 시작 마을 이동.
  useOfflineSimulation({
    enabled: currentRegion.enemies.length > 0,
    regionId: currentRegion.id,
    active: huntingActive,
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
      let anyKill = false;
      for (const [name, n] of Object.entries(result.killsByName)) {
        for (let i = 0; i < n; i += 1) {
          adventureLog.addKill(name);
          for (const id of quests.recordKill(name)) readyQuestIds.add(id);
          anyKill = true;
        }
      }
      if (anyKill) grantTitle("first_blood");
      // 포션 차감
      for (const [id, n] of Object.entries(result.potionsConsumed)) {
        if (n) inventory.consume(id as PotionId, n);
      }
      // EXP/HP/사망
      if (result.expGained > 0)
        characterStateHook.addExp(result.expGained, character.stats.vit);
      if (result.died) {
        // HP 0 + 시작 마을 강제 이동 + 마을 탭 치료소 sub 로 점프.
        // replace — 사망 시점은 history 에 남기지 않음.
        adventureLog.incrementBattleLosses();
        characterStateHook.setHp(0);
        replaceLocation("town", "healing");
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
    // 퀘스트 보상으로 레벨업 시에도 VIT 보너스만큼 maxHp 까지 풀회복.
    addExp: (n) => characterStateHook.addExp(n, character.stats.vit),
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
      <RegionBackground regionId={currentRegion.id} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 py-3 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex min-w-0 items-center gap-3">
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
            <ChatButton
              name={character.name}
              className={character.className}
              title={character.titleName ?? null}
            />
            <SettingsMenu />
          </div>
        </header>

        <MainTabs active={tab} onChange={handleTabChange} />

        <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6">
          {tab === "adventure" && subView === null && (
            <>
              <CharacterMini character={character} />
              {(() => {
                if (currentRegion.id !== "village") return null;
                if (crafting.state.boldQuestComplete) return null;
                const message = !crafting.knows("baseball_bat")
                  ? "지나가던 당신을 대장장이가 부릅니다."
                  : !crafting.hasCrafted("baseball_bat")
                    ? "대장장이가 망치질을 멈추고 당신을 흘끗 본다."
                    : "야구 방망이를 만든 당신을 대장장이가 다시 찾는다.";
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingTownNpcId("village_blacksmith_bold");
                      setSubView("town");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-amber-300/80 bg-amber-50/70 px-4 py-3 text-left transition-colors hover:bg-amber-100/70 dark:border-amber-900/60 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
                  >
                    <Hammer
                      size={28}
                      weight="duotone"
                      className="shrink-0 text-amber-600 dark:text-amber-400"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] uppercase tracking-wider text-amber-700/80 dark:text-amber-400/80">
                        알림판
                      </div>
                      <p className="mt-0.5 text-sm italic text-zinc-700 dark:text-zinc-300">
                        {message}
                      </p>
                    </div>
                  </button>
                );
              })()}
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
                onBack={back}
              />
              <TownView
                region={currentRegion}
                initialNpcId={pendingTownNpcId ?? undefined}
                onInitialNpcConsumed={() => setPendingTownNpcId(null)}
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
                  if (npc.id === "village_suzy") {
                    return (
                      <SuzyDialogue
                        npc={npc}
                        onClose={close}
                        storyFlags={storyFlags}
                        inventory={inventory}
                        characterStateHook={characterStateHook}
                        addNotification={addNotification}
                      />
                    );
                  }
                  if (npc.id === "diola_fisher") {
                    return (
                      <KaiDialogue
                        npc={npc}
                        onClose={close}
                        storyFlags={storyFlags}
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
              <SubViewHeader title="전투" onBack={back} />
              <BattleView
                region={currentRegion}
                player={playerCombat}
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
              />
            </div>
          )}
          {tab === "adventure" && subView === "map" && !trialEdge && (
            <div className="space-y-3">
              <SubViewHeader title="지도" onBack={back} />
              <MapView
                progress={mapProgress}
                onProgressChange={setMapProgress}
                log={adventureLog.log}
                playerHp={character.hp}
                isEdgeUnlocked={edgeUnlocks.isUnlocked}
                onTrialStart={(from, to) => {
                  const req = findEdgeRequirement(from, to);
                  if (!req || req.kind !== "trial") return;
                  setTrialEdge({
                    from,
                    to,
                    battles: req.battles,
                    enemiesFrom: req.enemiesFrom,
                  });
                }}
              />
            </div>
          )}
          {tab === "adventure" && subView === "map" && trialEdge && (
            <div className="space-y-3">
              <SubViewHeader
                title="시련"
                onBack={() => setTrialEdge(null)}
              />
              <TrialView
                trial={trialEdge}
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
                onBattleEnd={handleBattleEnd}
                onTrialEnd={(result) => {
                  if (result === "win" && trialEdge) {
                    edgeUnlocks.unlock(trialEdge.from, trialEdge.to);
                    setMapProgress((prev) => ({
                      currentRegionId: trialEdge.to,
                      visitedRegionIds: prev.visitedRegionIds.includes(
                        trialEdge.to,
                      )
                        ? prev.visitedRegionIds
                        : [...prev.visitedRegionIds, trialEdge.to],
                    }));
                    addNotification(
                      "info",
                      `시련 통과 — ${
                        WORLD_MAP.regions.find((r) => r.id === trialEdge.to)
                          ?.name ?? trialEdge.to
                      } 진입.`,
                    );
                  }
                  setTrialEdge(null);
                }}
                onAbort={() => setTrialEdge(null)}
                recentNotifications={notifications.list}
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
                title="치료소"
                description={
                  character.hp >= character.maxHp &&
                  character.mp >= character.maxMp
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
            </div>
          )}
          {tab === "town" && isTown && subView === "healing" && (() => {
            const healCost = character.gold < 50 ? 0 : 1;
            const isFull =
              character.hp >= character.maxHp &&
              character.mp >= character.maxMp;
            return (
              <div className="space-y-3">
                <SubViewHeader
                  title="시작 마을 치료소"
                  onBack={back}
                />
                <Card as="section" padding="md">
                  <div className="flex items-center gap-3">
                    <FirstAid
                      size={32}
                      weight="duotone"
                      className="shrink-0 text-rose-500"
                    />
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      체력과 마력을 모두 회복할 수 있다. 비용 1 G — 소지금이 50 G 미만이면 무료.
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
          })()}
          {tab === "town" && isTown && subView === "training" && (
            <div className="space-y-3">
              <SubViewHeader title="훈련장" onBack={back} />
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
              <SubViewHeader title="대장간" onBack={back} />
              <CraftingView
                knownIds={crafting.state.known}
                materialCounts={inventory.state.materials}
                potionCounts={inventory.state.potions}
                onCraft={handleCraft}
              />
            </div>
          )}
          {tab === "town" && isTown && subView === "shop" && (
            <div className="space-y-3">
              <SubViewHeader title="상점" onBack={back} />
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
          )}
          {tab === "town" && isTown && subView === "bulletin" && (
            <div className="space-y-3">
              <SubViewHeader title="게시판" onBack={back} />
              <BulletinBoardView />
            </div>
          )}
          {tab === "town" && isTown && subView === "inbox" && (
            <div className="space-y-3">
              <SubViewHeader title="우편함" onBack={back} />
              <InboxView
                remote={remote}
                addEquipment={inventory.addEquipment}
                addMaterial={inventory.addMaterial}
                addGold={characterStateHook.addGold}
                refreshInbox={inbox.refresh}
                pushToast={(msg) => addNotification("info", msg)}
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
          )}
          {tab === "character" && subView === "inventory" && (
            <div className="space-y-3">
              <SubViewHeader title="가방" onBack={back} />
              <InventoryView
                inventory={inventory.state}
                equipped={character.equipped}
                onEquip={handleEquipFromInventory}
                onUnequip={handleUnequip}
              />
            </div>
          )}
          {tab === "character" && subView === "skills" && (
            <div className="space-y-3">
              <SubViewHeader title="스킬" onBack={back} />
              <SkillsView skills={character.skills} />
            </div>
          )}
          {tab === "character" && subView === "adventure-log" && (
            <div className="space-y-3">
              <SubViewHeader title="모험의 서" onBack={back} />
              <AdventureLogView
                log={adventureLog.log}
                stats={character.stats}
                equippedTitleId={characterStateHook.equippedTitleId}
                onEquipTitle={characterStateHook.setEquippedTitle}
              />
            </div>
          )}
          {tab === "character" && subView === "recent-log" && (
            <div className="space-y-3">
              <SubViewHeader
                title="최근 기록"
                onBack={back}
              />
              <RecentLogView
                notifications={notifications.list}
                onClear={notifications.clear}
              />
            </div>
          )}
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
            </div>
          )}
          {tab === "plaza" && subView === "marketplace" && (
            <div className="space-y-3">
              <SubViewHeader title="거래소" onBack={back} />
              <MarketplaceTab
                inventory={inventory.state}
                equipped={equippedSlots}
                remote={remote}
                consumeEquipment={inventory.consumeEquipment}
                consumeMaterial={inventory.consumeMaterial}
                addEquipment={inventory.addEquipment}
                addMaterial={inventory.addMaterial}
                addGold={characterStateHook.addGold}
                currentGold={character.gold}
                inboxCount={inbox.count}
                refreshInbox={inbox.refresh}
                pushToast={(msg) => addNotification("info", msg)}
              />
            </div>
          )}
          {tab === "plaza" && subView === "inbox" && (
            <div className="space-y-3">
              <SubViewHeader title="우편함" onBack={back} />
              <InboxView
                remote={remote}
                addEquipment={inventory.addEquipment}
                addMaterial={inventory.addMaterial}
                addGold={characterStateHook.addGold}
                refreshInbox={inbox.refresh}
                pushToast={(msg) => addNotification("info", msg)}
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
