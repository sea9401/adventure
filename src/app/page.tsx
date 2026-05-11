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
import { type ConsumableId } from "@/adventure/data/consumables";
import type { ShopActionKind, ShopOutcome } from "@/adventure/shop/types";
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
import { resolveCraftedItem, type Recipe } from "@/adventure/data/recipes";
import { craftTierSuffix, type CraftTier } from "@/adventure/data/craftQuality";
import { craftErrorMessage, type CraftResult } from "@/adventure/crafting/types";
import type { EquippedItem } from "@/adventure/character/types";
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
import { onBattleEnd } from "@/adventure/battle/onBattleEnd";
import { useAutoHunt } from "@/adventure/hunting/useAutoHunt";
import {
  AutoHuntResultModal,
  fmtHuntDuration,
} from "@/adventure/battle/AutoHuntResultModal";
import { AUTO_HUNT_RESULT_KEY } from "@/adventure/battle/autoHunt";
import {
  summarizeOfflineResult,
  type OfflineSimResult,
} from "@/adventure/battle/offlineSim";
import { useGuildFameSync } from "@/adventure/guild/useGuildFameSync";
import { useGuildBuffsCache } from "@/adventure/guild/useGuildBuffsCache";
import { reportGuildQuestProgress } from "@/adventure/guild/api";
import { useShopUnlocks } from "@/adventure/shop/useShopUnlocks";
import { useStoryFlags } from "@/adventure/storyFlags/useStoryFlags";
import { SaveProvider, useSavedValue } from "@/lib/storage/SaveProvider";
import { useRemotePatch } from "@/lib/storage/useRemotePatch";
import { useNavTabs, type TabKey } from "@/lib/useNavTabs";
import { usePresenceHeartbeat } from "@/lib/usePresenceHeartbeat";
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

// /api/shop 의 ShopError code → 사용자 안내 문구.
function shopErrorMessage(code: string): string {
  switch (code) {
    case "insufficient_gold":
      return "골드가 부족하다.";
    case "full":
      return "더 들 수 없다.";
    case "insufficient_items":
      return "보유량이 부족하다.";
    case "locked":
      return "아직 상점에서 취급하지 않는 재료다.";
    default:
      return "상점 처리에 실패했다.";
  }
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

  // 자동 사냥 토글 — 이 세션·이 탭 한정 로컬 상태. 전투 화면에 머무는 동안에만 루프가
  // 돈다 (BattleView). 다른 탭/백그라운드로 가면 BattleView 가 unmount 되어 자연히 멈추고,
  // 돌아오면 다시 이어진다. 오프라인 누적·서버 동기화 없음 — "그 창에서만 전투".
  const [huntingActive, setHuntingActive] = useState(false);
  const trial = useTrialState({ tab, subView });

  // 자동 사냥 수령 결과 모달 — collect → reload 후 아래 마운트 핸들러가 sessionStorage 에서 읽어 세팅.
  const [autoHuntResult, setAutoHuntResult] = useState<OfflineSimResult | null>(
    null,
  );

  // 마을 진입 직후 자동으로 열 NPC 대화 — 알림판 클릭 시 세팅, TownView 가 마운트 직후 소비.
  const [pendingTownNpcId, setPendingTownNpcId] = useState<string | null>(null);

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
  // 타이머형 자동 사냥(1시간 원정) — dispatch/collect + 카운트다운. 라이브 huntingActive 와 별개.
  // collect 시 디바이스 자동 포션 룰을 서버 sim 에 전달 (서버에 동기화 안 됨).
  const autoHunt = useAutoHunt({
    getAutoPotionRules: () => autoPotion.config.rules,
  });
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
    setHuntingActive,
    replaceSubView,
  });

  const playerStatus = {
    gender: character.gender,
    mp: character.mp,
    maxMp: character.maxMp,
    exp: character.exp,
    maxExp: character.maxExp,
  };

  const addNotification = (
    kind: NotificationKind,
    text: string,
    meta?: NotificationMeta,
  ) => notifications.add(kind, text, meta);

  // 상점 buy/sell — 서버 권위 (audit-findings #1). 클라는 의도(kind/id/quantity)만 보내고,
  // 서버가 character.v2 / inventory.v2 를 잠그고 검증·적용한 새 값을 받아 in-memory state 를
  // replace. 이어지는 useRemotePatch 자동 PATCH 는 409→currentVersion 재시도로 자가 수렴.
  // 실패 시 사유를 토스트로 안내하고 null 반환.
  const runShopAction = async (body: {
    kind: ShopActionKind;
    id: string;
    quantity: number;
    craftTier?: number;
  }): Promise<{ applied: ShopOutcome["applied"] } | null> => {
    if (!Number.isInteger(body.quantity) || body.quantity < 1) return null;
    let res: Response;
    try {
      res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      addNotification("info", "통신 오류 — 잠시 후 다시 시도해 주세요.");
      return null;
    }
    if (res.status === 401 || res.status === 410) {
      // 세션 만료/무효 — 다음 저장 시도에서 SaveProvider 가 안내. 여기선 조용히 실패.
      return null;
    }
    const data = (await res.json().catch(() => null)) as
      | { ok: true; character: unknown; inventory: unknown; applied: ShopOutcome["applied"] }
      | { ok: false; error: string }
      | null;
    if (!data) {
      addNotification("info", "상점 처리에 실패했다.");
      return null;
    }
    if (data.ok === false) {
      addNotification("info", shopErrorMessage(data.error));
      return null;
    }
    characterStateHook.replaceFromSaved(data.character);
    inventory.replaceFromSaved(data.inventory);
    return { applied: data.applied };
  };

  const handlePurchasePotion = async (id: PotionId, quantity: number) => {
    await runShopAction({ kind: "buy_potion", id, quantity });
  };

  const handlePurchaseMaterial = async (id: MaterialId, quantity: number) => {
    await runShopAction({ kind: "buy_material", id, quantity });
  };

  const handlePurchaseConsumable = async (
    id: ConsumableId,
    quantity: number,
  ) => {
    await runShopAction({ kind: "buy_consumable", id, quantity });
  };

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

  // 판매 — 서버가 인벤토리에서 차감 + 골드 지급. 0G 아이템은 단순 정리(버리기) 효과.
  // 토스트/칭호/해금 알림은 서버가 알려준 applied(실제 적용 수량·골드)로 구성.
  const handleSellPotion = async (id: PotionId, quantity: number) => {
    const r = await runShopAction({ kind: "sell_potion", id, quantity });
    if (!r) return;
    const { quantity: qty, goldDelta: total } = r.applied;
    addNotification(
      "info",
      total > 0
        ? `${POTIONS[id].name} ×${qty}을(를) ${total}G에 팔았다.`
        : `${POTIONS[id].name} ×${qty}을(를) 버렸다.`,
    );
  };

  const handleSellMaterial = async (id: MaterialId, quantity: number) => {
    const r = await runShopAction({ kind: "sell_material", id, quantity });
    if (!r) return;
    const { quantity: qty, goldDelta: total } = r.applied;
    addNotification(
      "info",
      total > 0
        ? `${MATERIALS[id].name} ×${qty}을(를) ${total}G에 팔았다.`
        : `${MATERIALS[id].name} ×${qty}을(를) 버렸다.`,
    );
    // 누적 판매량 100 도달 시 상점에서 구매 가능. 처음 도달한 순간만 알림.
    // 임계치를 처음 넘긴 시점에 '상인' 칭호도 함께 부여 (이미 보유면 idempotent).
    // shop.unlocks.v1 은 진행 마커라 클라 권위 유지 (server-authority-plan v1 비대상) —
    // 서버 material-buy 검증은 이 PATCH 가 동기화된 값을 read-only 로 본다.
    const crossed = shopUnlocks.recordSale(id, qty);
    if (crossed) {
      addNotification(
        "info",
        `상점에서 ${MATERIALS[id].name}을(를) 취급하기 시작했다.`,
      );
      grantTitle("merchant");
    }
  };

  const handleSellEquipment = async (
    id: ItemId,
    quantity: number,
    craftTier?: CraftTier,
  ) => {
    const r = await runShopAction({ kind: "sell_equipment", id, quantity, craftTier });
    if (!r) return;
    const { quantity: qty, goldDelta: total } = r.applied;
    const name = ITEMS[id].name + craftTierSuffix(craftTier);
    addNotification(
      "info",
      total > 0
        ? `${name}${qty > 1 ? ` ×${qty}` : ""}을(를) ${total}G에 팔았다.`
        : `${name}${qty > 1 ? ` ×${qty}` : ""}을(를) 버렸다.`,
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

  // 슬롯에 장착돼 있던 장비를 인벤토리로 회수 — 제작산이면 등급별 칸으로, 아니면 무등급으로.
  const returnEquippedToInventory = (item: EquippedItem | null) => {
    if (!item) return;
    const id = findItemId(item);
    if (!id) return;
    const tier = item.craftTier;
    if (tier != null && tier !== 0) inventory.addCraftedEquipment(id, tier, 1);
    else inventory.addEquipment(id, 1);
  };

  // 인벤토리에서 장비를 꺼내 장착. 보유분에서 1개 차감, 기존 장비는 회수.
  // tier 미지정/0 = 무등급(또는 일반 등급) 스택, ±1·±2 = 제작산 등급 스택.
  const handleEquipFromInventory = (id: ItemId, tier?: CraftTier) => {
    const isCrafted = tier != null && tier !== 0;
    if (isCrafted) {
      if (!inventory.consumeCraftedEquipment(id, tier, 1)) return;
    } else {
      if (!inventory.consumeEquipment(id, 1)) return;
    }
    const item = ITEMS[id];
    const equipItem: EquippedItem = isCrafted ? resolveCraftedItem(id, tier) : item;
    returnEquippedToInventory(characterStateHook.equippedSlots[item.slot]);
    characterStateHook.setSlot(item.slot, equipItem);
    const suffix = craftTierSuffix(equipItem.craftTier);
    addNotification("info", `${item.name}${suffix}을(를) 장착했다.`, {
      highlight: { name: item.name + suffix, className: rarityTextClass(item) },
    });
  };

  const handleUnequip = (slot: EquipSlot) => {
    const current = characterStateHook.equippedSlots[slot];
    if (!current) return;
    returnEquippedToInventory(current);
    characterStateHook.setSlot(slot, null);
    const suffix = craftTierSuffix(current.craftTier);
    addNotification("info", `${current.name}${suffix}을(를) 해제했다.`, {
      highlight: { name: current.name + suffix, className: rarityTextClass(current) },
    });
  };

  // 인벤토리에서 장비 1개 폐기 — 보상 없음. (장착 중인 장비는 인벤토리 카운트 밖이라
  // 애초에 폐기 대상이 안 됨 — 가방엔 여분만 보인다.) 순수 제거라 서버 권위 불필요 — consume 후
  // useRemotePatch 가 동기화.
  const handleDiscardFromInventory = (id: ItemId, tier?: CraftTier) => {
    const isCrafted = tier != null && tier !== 0;
    const ok = isCrafted
      ? inventory.consumeCraftedEquipment(id, tier, 1)
      : inventory.consumeEquipment(id, 1);
    if (!ok) return;
    const suffix = craftTierSuffix(tier);
    addNotification("info", `${ITEMS[id].name}${suffix}을(를) 폐기했다.`);
  };

  // 제작 — 서버 권위 (audit-findings #1 후속). 클라는 recipeId 만 보내고, 서버가 inventory.v2 /
  // crafting.v2 를 잠그고 검증·적용(품질 등급 추첨 포함)한 새 값을 받아 in-memory state 를
  // replace. 이어지는 useRemotePatch 자동 PATCH 는 409→재시도로 자가 수렴 (상점과 동일).
  // 사전 검사(재료/포션 한도)는 UX 용 — 라운드트립 전에 부족분을 안내. 권한은 서버가 갖는다.
  const handleCraft = async (recipe: Recipe) => {
    for (const ing of recipe.ingredients) {
      if (ing.kind === "material") {
        if (inventory.materialCount(ing.materialId) < ing.count) {
          addNotification(
            "info",
            `재료가 부족하다 — ${MATERIALS[ing.materialId].name} ${ing.count}개 필요.`,
          );
          return;
        }
      } else {
        const have =
          (inventory.state.equipment[ing.itemId] ?? 0) +
          inventory.craftedTotalCount(ing.itemId);
        if (have < ing.count) {
          addNotification(
            "info",
            `재료가 부족하다 — ${ITEMS[ing.itemId].name} ${ing.count}개 필요.`,
          );
          return;
        }
      }
    }
    if (recipe.result.kind === "potion") {
      const have = inventory.state.potions[recipe.result.potionId] ?? 0;
      if (have + recipe.result.quantity > inventory.potionMax) {
        addNotification(
          "info",
          `${POTIONS[recipe.result.potionId].name}을(를) 더 들 수 없다.`,
        );
        return;
      }
    }

    let res: Response;
    try {
      res = await fetch("/api/craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: recipe.id }),
      });
    } catch {
      addNotification("info", "통신 오류 — 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (res.status === 401 || res.status === 410) return;
    const data = (await res.json().catch(() => null)) as
      | { ok: true; inventory: unknown; crafting: unknown; result: CraftResult }
      | { ok: false; error: string }
      | null;
    if (!data) {
      addNotification("info", "제작에 실패했다.");
      return;
    }
    if (data.ok === false) {
      addNotification("info", craftErrorMessage(data.error));
      return;
    }
    inventory.replaceFromSaved(data.inventory);
    crafting.replaceFromSaved(data.crafting);

    if (data.result.kind === "equipment") {
      const item = ITEMS[data.result.itemId];
      const suffix = craftTierSuffix(data.result.tier);
      addNotification("info", `${item.name}${suffix}을(를) 만들었다.`, {
        highlight: { name: item.name + suffix, className: rarityTextClass(item) },
      });
    } else {
      const potion = POTIONS[data.result.potionId];
      const qty = data.result.quantity;
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
      setHuntingActive,
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

  // 자동 사냥 수령 → collect 가 sessionStorage 에 결과 박고 reload. 여기서 읽어 모달 표시 +
  // 도감/퀘스트 진행도(클라 KV) 추가 반영 + 알림. (서버는 character/inventory/crafting/map 만
  // 갱신했고 adventureLog.v2 / quest-progress.v2 는 별도 키라 여기서 누적.)
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(AUTO_HUNT_RESULT_KEY);
      if (raw) sessionStorage.removeItem(AUTO_HUNT_RESULT_KEY);
    } catch {}
    if (!raw) return;
    let result: OfflineSimResult;
    try {
      result = JSON.parse(raw) as OfflineSimResult;
    } catch {
      return;
    }
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
    addNotification(
      result.died ? "battle_lose" : "info",
      `자동 사냥 ${fmtHuntDuration(result.simulatedMs)}${summary ? ` — ${summary}` : ""}`,
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
    // sessionStorage(외부) 에서 가져온 1회성 결과 → 모달 state 로 동기화.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoHuntResult(result);
    // 빈 deps — 마운트 1회만. adventureLog/quests/addNotification 등은 hook 들의 stable wrapper.
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
    huntingActive,
    setHuntingActive,
    autoHunt,
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
    handleDiscardFromInventory,
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
            {huntingActive && currentRegion.enemies.length > 0 && (
              <span
                title="라이브 자동 전투 진행 중"
                aria-label="라이브 자동 전투 진행 중"
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
              >
                <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                사냥
              </span>
            )}
            {autoHunt.isDispatched && (
              <span
                title="자동 사냥(원정) 진행 중"
                aria-label="자동 사냥 원정 진행 중"
                className="inline-flex items-center gap-1 rounded-full border border-sky-500/50 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-sky-700 dark:text-sky-300"
              >
                <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                {autoHunt.state === "complete"
                  ? "원정 완료"
                  : `원정 ${Math.floor(autoHunt.remainingMs / 60_000)}:${String(
                      Math.floor(autoHunt.remainingMs / 1000) % 60,
                    ).padStart(2, "0")}`}
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
      {autoHuntResult && (
        <AutoHuntResultModal
          result={autoHuntResult}
          onClose={() => setAutoHuntResult(null)}
        />
      )}
    </GameProvider>
  );
}
