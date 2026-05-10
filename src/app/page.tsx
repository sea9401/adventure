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
import { WORLD_MAP } from "@/adventure/data/world";
import {
  initialMapProgress,
  type MapProgress,
} from "@/lib/map-progress";
import { START_REGION_ID } from "@/adventure/data/world";
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
import { isNewbieBonusActive, requiredExpToNext } from "@/lib/leveling";
import { BulletinBoardView } from "@/adventure/BulletinBoardView";
import type { NotificationKind, NotificationMeta } from "@/lib/notifications";
import { useNotifications } from "@/adventure/notifications/useNotifications";
import { TabBar } from "@/components/ui/TabBar";
import { EntryCard } from "@/components/ui/EntryCard";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { RegionBackground } from "@/components/ui/RegionBackground";
import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import { formatDuration } from "@/lib/format";
import type { Character } from "@/adventure/character/types";
import { ZERO_ALLOCATED } from "@/adventure/character/statMeta";
import { useTraining } from "@/adventure/training/useTraining";
import {
  baseCharacter,
  maxHpForLevel,
  maxMpForLevel,
} from "@/adventure/character/defaults";
import { useCharacterState } from "@/adventure/character/useCharacterState";
import { useProfile } from "@/adventure/profile/useProfile";
import { useTrialUnlocks } from "@/adventure/edges/useTrialUnlocks";
import { type TrialEdge } from "@/adventure/TrialView";
import {
  counterAtkBonusFor,
  critChancePctFor,
  critMultFor,
  crushDefReductionFor,
  deriveSkills,
  doubleLuckBonusesFor,
  doubleStrikeIntervalFor,
  effectiveSkillNames,
  enduranceActiveFor,
  enduranceMaxHpBonusPctFor,
  evadeBonusPctFor,
  evadeGuaranteedFor,
  executionDamageMultFor,
  executionHpFractionFor,
  guardFor,
  lightspeedExtraAttackPctFor,
  powerAttackBonusFor,
  precisionEvasionMultFor,
  regenFor,
  vanguardFirstTurnBonusFor,
} from "@/adventure/character/skills";
import { getTitle, COUNTER_TITLES } from "@/adventure/data/titles";
import { useOfflineSimulation } from "@/adventure/battle/useOfflineSimulation";
import {
  simulateOfflineHunt,
  summarizeOfflineResult,
  OFFLINE_SIM_MAX_MS,
  type OfflineSimResult,
} from "@/adventure/battle/offlineSim";
import { OfflineRewardsModal } from "@/adventure/battle/OfflineRewardsModal";
import { PLAYER_TURN_INTERVAL_MS } from "@/adventure/battle/useBattle";
import { onBattleEnd } from "@/adventure/battle/onBattleEnd";
import { useGuildFameSync } from "@/adventure/guild/useGuildFameSync";
import { reportGuildQuestProgress } from "@/adventure/guild/api";
import { pickAutoAction } from "@/adventure/battle/pickAutoAction";
import { useShopUnlocks } from "@/adventure/shop/useShopUnlocks";
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
  // 자동 사냥 중 탭/앱이 백그라운드 → 복귀 시 누적 보상 모달.
  // 한 번에 하나만 표시 — 새 결과가 들어오면 직전 것을 덮어쓴다.
  const [offlineRewards, setOfflineRewards] = useState<OfflineSimResult | null>(
    null,
  );
  // 마을 진입 직후 자동으로 열 NPC 대화 — 알림판 클릭 시 세팅, TownView 가 마운트 직후 소비.
  const [pendingTownNpcId, setPendingTownNpcId] = useState<string | null>(null);
  // 시련(trial) 진행 상태 — 엣지 + 누적 승수. 영구 저장 (trial.v1) 으로 reload /
  // 백그라운드 복귀 후 location.reload 가 발생해도 진행도가 살아남는다.
  // 사용자가 모험/지도 외 화면으로 나가면 자동 취소(아래 useEffect 에서 setTrial(null)).
  type PersistedTrial = { edge: TrialEdge; winCount: number };
  const initialTrial = useSavedValue<PersistedTrial | null>("trial.v1");
  const [trial, setTrial] = useState<PersistedTrial | null>(() => {
    if (!initialTrial || typeof initialTrial !== "object") return null;
    if (!initialTrial.edge || typeof initialTrial.winCount !== "number") return null;
    return initialTrial;
  });
  useRemotePatch("trial.v1", trial);
  const trialEdge = trial?.edge ?? null;
  const trialWinCount = trial?.winCount ?? 0;
  const startTrial = (edge: TrialEdge) => setTrial({ edge, winCount: 0 });
  const endTrial = () => setTrial(null);
  const recordTrialWin = (winCount: number) =>
    setTrial((prev) => (prev ? { ...prev, winCount } : prev));
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

  // 시련 중 사용자가 다른 탭/서브뷰로 이동하면 시련 자동 취소.
  // (저장된 trial 이 있어도 사용자가 명시적으로 다른 곳으로 가면 끊는다 — 의도적 abort.)
  // reload/visibilitychange 로 인한 location.reload 후엔 URL 이 보존돼 같은 위치에서
  // 복귀하므로 trial 도 그대로 살아남는다.
  useEffect(() => {
    if (!trial) return;
    if (tab !== "adventure" || subView !== "map") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      endTrial();
    }
  }, [tab, subView, trial]);

  // region 변경 시 자동 사냥 해제 — 다른 곳으로 이동했으면 그 region에서의 자동 사냥은 끝.
  // 첫 mount(baseline 기록) 시에는 변경 감지하지 않도록 ref로 분기.
  // huntingActive 가 ON 이었던 경우만 안내 토스트 — 사용자가 정지 사실을 명확히 인지.
  // (effect deps 에 huntingActive 를 넣지 않기 위해 ref 로 latest 캡처.)
  // huntingActive 가 ON 이면 setHuntingActive(false) 직전에 offline sim flush —
  // 사용자가 사냥 ON 상태로 지도/마을로 이동한 경우 그 사이에 누적된 보상이 손실되지
  // 않도록. flushOfflineSim 은 useOfflineSimulation 이 나중에 정의돼 ref bridging 사용.
  const lastRegionForHuntRef = useRef<string | null>(null);
  const huntingActiveRef = useRef(huntingActive);
  const flushOfflineSimRef = useRef<() => void>(() => {});
  useEffect(() => {
    huntingActiveRef.current = huntingActive;
  });
  useEffect(() => {
    if (lastRegionForHuntRef.current === null) {
      lastRegionForHuntRef.current = mapProgress.currentRegionId;
      return;
    }
    if (lastRegionForHuntRef.current !== mapProgress.currentRegionId) {
      if (huntingActiveRef.current) {
        flushOfflineSimRef.current();
        addNotification("info", "지역 이동으로 자동 사냥이 정지됐다.");
      }
      setHuntingActive(false);
      lastRegionForHuntRef.current = mapProgress.currentRegionId;
    }
    // addNotification/setHuntingActive 는 setter — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const equippedSkillSet = new Set(characterState.equippedSkills);
  // VIT 1pt 당 maxHp +2 — 레벨 기준 max 위에 스탯 보너스를 얹고, 불굴 장착 시 +N%.
  const enduranceHpBonusPct = enduranceMaxHpBonusPctFor(
    totalStats,
    equippedSkillSet,
  );
  const characterMaxHp = Math.floor(
    (maxHpForLevel(characterState.level) + totalStats.vit * 2) *
      (1 + enduranceHpBonusPct / 100),
  );
  const characterMaxMp = maxMpForLevel(characterState.level);
  const equippedTitle = getTitle(characterStateHook.equippedTitleId);
  const characterSkills = deriveSkills(totalStats);
  const effectiveSkillNameList = effectiveSkillNames(
    characterSkills,
    characterState.equippedSkills,
  );
  const effectiveSkillSet = new Set(effectiveSkillNameList);
  // 전투 전적 = 누적 처치 + 누적 패배. 도주 경로가 없어 둘의 합이 곧 전투 횟수.
  const totalMonsterKills = Object.values(adventureLog.log.monsters).reduce(
    (sum, m) => sum + (m.kills ?? 0),
    0,
  );
  const battleCount =
    totalMonsterKills + (adventureLog.log.battleLosses ?? 0);
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
    battleCount,
    equipped: equippedSlots,
    stats: totalStats,
    skills: characterSkills,
    affiliation:
      characterStateHook.state.affiliation ?? baseCharacter.affiliation,
  };
  usePresenceHeartbeat({
    name: character.name,
    className: character.className,
    title: character.titleName ?? null,
  });
  useGuildFameSync(character.fame);

  const showModal = profile.needsSetup;
  const currentRegion =
    WORLD_MAP.regions.find((r) => r.id === mapProgress.currentRegionId) ??
    WORLD_MAP.regions[0];
  const isTown = currentRegion.tags?.includes("town") ?? false;

  useEffect(() => {
    adventureLog.markRegionVisited(currentRegion.id);
  }, [currentRegion.id, adventureLog]);

  // 안전망 — HP<=0 인데 마을이 아닌 곳(사냥 지역 등)에 있으면 복귀 마을로 강제 이동.
  // 패배 모달을 확인하기 전에 새로고침/탭 닫기 등으로 빠져나가 stuck 된 유저를 다음 진입에서 구출.
  // 외부 상태(hp/region)를 관찰해 위치 보정 — 의도적 set-state-in-effect.
  // HP 도 1 로 끌어올림 — region 패치가 409 등으로 실패해 다음 mount 에서 같은 위치/HP=0 로
  // 돌아와도 hp>0 가드가 안전망 재발동을 차단해 무한 루프 (매 새로고침마다 같은 곳으로
  // 텔레포트) 를 끊는다.
  // huntingActive 도 함께 정리 — 다음 render 의 region 변경 effect 가 huntingActiveRef
  // 를 false 로 보고 "지역 이동으로 자동 사냥이 정지됐다" 유령 토스트를 띄우지 않게.
  useEffect(() => {
    if (characterState.hp > 0) return;
    if (isTown) return;
    const respawnId = mapProgress.respawnRegionId ?? START_REGION_ID;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMapProgress((prev) => ({
      ...prev,
      currentRegionId: respawnId,
      visitedRegionIds: prev.visitedRegionIds.includes(respawnId)
        ? prev.visitedRegionIds
        : [...prev.visitedRegionIds, respawnId],
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    characterStateHook.setHp(1);
    setHuntingActive(false);
    replaceSubView(null);
    // setMapProgress/replaceSubView/setHp/setHuntingActive 안정 참조 — deps 제외.
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
  //   민첩 DEX : +0.5% 회피 / pt, +1 atk / 5pt
  //   활력 VIT : +1 def / pt, +2 maxHp / pt (maxHp는 character 빌드 단계에서 반영)
  //                — 추가: 최종 def(=vit + 방어구) 5당 +1 atk (테마: 두꺼운 갑옷이 묵직한 일격)
  //   속도 SPD : 1pt 당 추가 공격 확률 +2.5% (매 턴 1회 판정, 100% capping), +1 atk / 5pt
  //   행운 LUK : +1% 드랍률 / pt, +0.5% 크리 확률 / pt, +0.025x 크리 데미지 / pt, +1 atk / 5pt
  // 비-str 스탯의 5pt=+1 atk 환산은 보스 def 한계(1 데미지 함정) 회피와 빌드 다양성을
  // 위한 의도적 조정. str 의 1pt=+1 우위는 그대로 유지된다.
  const playerDef = character.stats.vit + equipDef;
  const playerCombat = {
    hp: character.hp,
    maxHp: character.maxHp,
    atk:
      character.stats.str +
      Math.floor(character.stats.dex / 5) +
      Math.floor(playerDef / 5) +
      Math.floor(character.stats.luk / 5) +
      Math.floor(character.stats.spd / 5) +
      equipAtk,
    def: playerDef,
    spd: character.stats.spd,
    evasionPct:
      character.stats.dex * 0.5 +
      evadeBonusPctFor(character.stats, effectiveSkillSet),
    attackCount: 1,
    extraAttackChancePct: Math.min(100, character.stats.spd * 2.5),
    powerAttackBonus: powerAttackBonusFor(character.stats, effectiveSkillSet),
    crushDefReduction: crushDefReductionFor(
      character.stats,
      effectiveSkillSet,
    ),
    guaranteedEvades: evadeGuaranteedFor(character.stats, effectiveSkillSet),
    counterAtkBonus: counterAtkBonusFor(character.stats, effectiveSkillSet),
    extraAttackEveryNTurns: doubleStrikeIntervalFor(
      character.stats,
      effectiveSkillSet,
    ),
    vanguardFirstTurnBonus: vanguardFirstTurnBonusFor(
      character.stats,
      effectiveSkillSet,
    ),
    critChancePct: critChancePctFor(character.stats, effectiveSkillSet),
    critMult: critMultFor(character.stats, effectiveSkillSet),
    doubleLuck: doubleLuckBonusesFor(character.stats, effectiveSkillSet),
    guard: guardFor(character.stats, effectiveSkillSet),
    regen: regenFor(character.stats, effectiveSkillSet),
    executionDamageMult: executionDamageMultFor(
      character.stats,
      effectiveSkillSet,
    ),
    executionHpFraction: executionHpFractionFor(
      character.stats,
      effectiveSkillSet,
    ),
    precisionEvasionMult: precisionEvasionMultFor(
      character.stats,
      effectiveSkillSet,
    ),
    enduranceActive: enduranceActiveFor(character.stats, effectiveSkillSet),
    lightspeedExtraAttackPct: lightspeedExtraAttackPctFor(
      character.stats,
      effectiveSkillSet,
    ),
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
        `신참 보너스 활성 — 5레벨 미만 동안 사냥/퀘스트 EXP ×2.`,
      );
    }
    // 시련 재개 안내는 사용자가 실제 시련 화면(adventure/map) 으로 들어왔을 때만.
    // 자동사냥(adventure/battle)/마을/캐릭터 등 다른 곳에서는 곧 L260 effect 가
    // trial 을 자동 취소하므로 안내가 무의미하고, reload 사이클마다 stale 한
    // trial.v1 로 인해 알림이 반복 누적되는 원인이 된다.
    if (
      tab === "adventure" &&
      subView === "map" &&
      trial &&
      trial.winCount > 0
    ) {
      addNotification(
        "info",
        `시련 이어서 진행 — ${trial.winCount} / ${trial.edge.battles}.`,
      );
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

  // 레벨업 감지 — character.level 증가 시 스탯 포인트 지급 + 알림 + 오버레이.
  // SaveProvider 가 마운트 전에 character.v1 을 hydrate 하므로 첫 effect 의
  // characterState.level 은 이미 저장된 값. ref 로 베이스라인만 잡고,
  // 이후 증가분만 레벨업으로 처리.
  const [levelUpTrigger, setLevelUpTrigger] = useState(0);
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
      setLevelUpTrigger((v) => v + 1);
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

  // 카운터형 칭호 — COUNTER_TITLES 표를 한 번에 돌며 임계값 도달분 등록.
  // 외부 상태(battleLosses/trainingCount/chatCount/healingCount)를 관찰해 칭호 등록 — 의도적 set-state-in-effect.
  const battleLosses = adventureLog.log.battleLosses ?? 0;
  const trainingCount = training.completedCount;
  const chatCount = adventureLog.log.chatCount ?? 0;
  const healingCount = adventureLog.log.healingCount ?? 0;
  useEffect(() => {
    const counters: Record<string, number> = {
      battleLosses,
      trainingCount,
      chatCount,
      healingCount,
    };
    for (const t of COUNTER_TITLES) {
      if ((counters[t.key] ?? 0) >= t.target) grantTitle(t.id);
    }
    // grantTitle 안정 참조 — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleLosses, trainingCount, chatCount, healingCount]);

  // 새벽 3~5시 접속 → '새벽반' 칭호 자동 등록. 마운트 시 1회 평가.
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 3 && hour < 5) grantTitle("early_bird");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 상태 관찰형 칭호 — gold 0 도달, 동일 NPC 100회 대화, 외골수 빌드.
  // 외골수: 한 스탯 30↑, 나머지 모두 10↓ (11~29 구간이 있으면 미부여).
  const goldZero = characterState.gold === 0;
  const maxNpcTalkCount = Object.values(adventureLog.log.npcs).reduce(
    (max, e) => Math.max(max, e?.talkCount ?? 0),
    0,
  );
  useEffect(() => {
    if (goldZero) grantTitle("beggar");
    if (maxNpcTalkCount >= 100) grantTitle("phisher");
    const high = STAT_KEYS.filter((k) => totalStats[k] >= 30).length;
    const low = STAT_KEYS.filter((k) => totalStats[k] <= 10).length;
    if (high === 1 && low === STAT_KEYS.length - 1) grantTitle("one_track");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    goldZero,
    maxNpcTalkCount,
    totalStats.str,
    totalStats.dex,
    totalStats.vit,
    totalStats.spd,
    totalStats.luk,
  ]);

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
    });

  const handleAcceptQuest = (id: string) => {
    quests.accept(id);
  };

  // 오프라인 자동 사냥 — 페이지/탭을 떠난 동안 일어났을 일을 결정적으로 한 번에 시뮬.
  // 30분 cap + 사망 시 break + 시작 마을 이동.
  // "away" 판정은 (브라우저 탭 hidden) || (배틀뷰 아님) — in-app 으로 캐릭터/광장 보는
  // 동안에도 자동 사냥이 끊기지 않게.
  const { flushNow: flushOfflineSim } = useOfflineSimulation({
    enabled: currentRegion.enemies.length > 0,
    regionId: currentRegion.id,
    active: huntingActive,
    isInBattleView: tab === "adventure" && subView === "battle",
    playerHp: character.hp,
    runSim: (awayMs, baselineHp, baselineRegionId) => {
      // baseline 시점의 region 으로 lookup — 명시 중지 후 region 이 이미 바뀐 상태에서
      // flushNow 가 호출돼도 그 시점에 사냥하던 region 의 적/드롭으로 정상 보상.
      const baselineRegion =
        WORLD_MAP.regions.find((r) => r.id === baselineRegionId) ??
        currentRegion;
      return simulateOfflineHunt({
        // baseline 시점의 HP 로 sim — 마을 회복 후 부풀린 HP 가 sim 에 반영되는 익스플로잇 차단.
        player: { ...playerCombat, hp: baselineHp },
        playerName: profile.name,
        region: baselineRegion,
        playerLevel: character.level,
        playerExp: character.exp,
        potions: inventory.state.potions,
        turnIntervalMs: PLAYER_TURN_INTERVAL_MS,
        awayMs,
        luk: character.stats.luk,
        knowsRecipe: crafting.knows,
        pickAction: (state) =>
          pickAutoAction(state, {
            rules: autoPotion.config.rules,
            potions: inventory.state.potions,
          }),
      });
    },
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
      // 드롭 — 골드/재료/장비/제작서. 학습 가능 여부는 sim 단계에서 이미 필터링됨.
      if (result.goldGained > 0)
        characterStateHook.addGoldFame(result.goldGained, 0);
      for (const [id, n] of Object.entries(result.materialsGained)) {
        if (n) inventory.addMaterial(id as MaterialId, n);
      }
      for (const itemId of result.equipsGained) {
        inventory.addEquipment(itemId);
      }
      for (const recipeId of result.recipesLearned) {
        crafting.learnRecipe(recipeId);
      }
      // EXP/HP/사망
      if (result.expGained > 0)
        characterStateHook.addExp(result.expGained, character.stats.vit);
      if (result.died) {
        // HP 0 + 복귀 마을 강제 이동 + 마을 탭 치료소 sub 로 점프.
        // replace — 사망 시점은 history 에 남기지 않음.
        adventureLog.incrementBattleLosses();
        characterStateHook.setHp(0);
        replaceLocation("town", "healing");
        const respawnId = mapProgress.respawnRegionId ?? START_REGION_ID;
        setMapProgress((prev) => ({
          ...prev,
          currentRegionId: respawnId,
          visitedRegionIds: prev.visitedRegionIds.includes(respawnId)
            ? prev.visitedRegionIds
            : [...prev.visitedRegionIds, respawnId],
        }));
      } else {
        characterStateHook.setHp(result.finalPlayerHp);
      }
      // 요약 알림
      const summary = summarizeOfflineResult(result);
      const minutes = Math.max(1, Math.round(result.simulatedMs / 60_000));
      // cap 라벨은 실제로 30분에 걸려 끊긴 경우에만 표시 — 사망/적 부재 등으로 일찍 끝났으면 의미 없음.
      const cap =
        result.cappedByLimit && result.simulatedMs >= OFFLINE_SIM_MAX_MS
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
      // 누적 보상을 모달로 가시화 — 알림은 작아 놓치기 쉬움.
      setOfflineRewards(result);
    },
  });
  // ref bridging — 위쪽 region 변경 useEffect 가 setHuntingActive(false) 직전에
  // 호출. flushOfflineSim 자체는 stable 하므로 매 render 갱신해도 비용 없음.
  flushOfflineSimRef.current = flushOfflineSim;

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
    trialEdge,
    trialWinCount,
    startTrial,
    endTrial,
    recordTrialWin,
    huntingActive,
    setHuntingActive,
    tab,
    subView,
    setSubView,
    back,
    addNotification,
    grantTitle,
    handlePurchasePotion,
    handlePurchaseMaterial,
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
            {huntingActive && currentRegion.enemies.length > 0 && (
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
              notifications={notifications.alertable}
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
      <NotificationToast notifications={notifications.alertable} />
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
