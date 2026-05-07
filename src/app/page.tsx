"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Backpack,
  Barbell,
  BookOpen,
  Coins,
  Compass,
  Diamond,
  FirstAid,
  Hammer,
  HandFist,
  HeartStraight,
  Lightning,
  MapPin,
  Scroll,
  Shield,
  Sparkle,
  Star,
  Storefront,
  Sword,
  User,
  Wind,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NameSetupModal, type Gender } from "@/components/NameSetupModal";
import { MapView } from "@/adventure/MapView";
import { BattleView, type BattleEndPayload } from "@/adventure/BattleView";
import { TownView } from "@/adventure/TownView";
import { NpcDialogue } from "@/adventure/NpcDialogue";
import type { Npc } from "@/adventure/data/npcs";
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
import {
  ITEMS,
  findItemId,
  type EquipItem,
  type ItemId,
} from "@/adventure/data/items";
import { MONSTERS } from "@/adventure/data/monsters";
import {
  POTIONS,
  POTION_IDS,
  POTION_MAX_PER_TYPE,
  computeHealAmount,
  type PotionId,
} from "@/adventure/data/potions";
import { useInventory } from "@/adventure/inventory/useInventory";
import { useAutoPotionConfig } from "@/adventure/inventory/useAutoPotionConfig";
import { InventoryView } from "@/adventure/InventoryView";
import { ShopView } from "@/adventure/ShopView";
import type { BattleState, PlayerAction } from "@/adventure/battle/engine";
import { type Recipe } from "@/adventure/data/recipes";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { useCrafting } from "@/adventure/crafting/useCrafting";
import { STORY_QUESTS } from "@/adventure/data/storyQuests";
import {
  applyExpGain,
  MAX_LEVEL,
  requiredExpToNext,
} from "@/lib/leveling";
import { CraftingView } from "@/adventure/CraftingView";
import {
  genNotificationId,
  loadNotifications,
  saveNotifications,
  MAX_NOTIFICATIONS,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { StatBar } from "@/components/ui/StatBar";
import { EntryCard } from "@/components/ui/EntryCard";
import { SubViewHeader } from "@/components/ui/SubViewHeader";
import { RegionBackground } from "@/components/ui/RegionBackground";
import {
  PROFILE_STORAGE_KEY,
  LEGACY_PROFILE_KEYS,
  TRAINING_STORAGE_KEY,
  CHARACTER_STATE_KEY,
  BATTLE_SETTINGS_KEY,
} from "@/lib/storage-keys";
import {
  STAT_KEYS,
  STAT_LABELS,
  type StatKey,
} from "@/adventure/data/stats";
import { formatDuration } from "@/lib/format";

const DEFAULT_NAME = "모험가";

type Profile = { name: string; gender: Gender };

const TRAINING_DURATION_MS = 4 * 60 * 60 * 1000;

type EquippedSlots = {
  weapon: EquipItem | null;
  armor: EquipItem | null;
  accessory: EquipItem | null;
};

type CharacterDynamicState = {
  hp: number;
  mp: number;
  level: number;
  exp: number;
  gold: number;
  fame: number;
  equipped?: EquippedSlots;
};

const initialCharacterState: CharacterDynamicState = {
  hp: 50,
  mp: 30,
  level: 1,
  exp: 0,
  gold: 0,
  fame: 0,
};

// EquipBonus / EquipItem 타입은 src/adventure/data/items.ts로 이동됨.
export type { EquipBonus } from "@/adventure/data/items";

type Skill = {
  name: string;
  description?: string;
};

const STAT_ICONS: Record<StatKey, PhosphorIcon> = {
  str: HandFist,
  dex: Lightning,
  vit: HeartStraight,
  spd: Wind,
  luk: Star,
};

const STAT_ICON_COLORS: Record<StatKey, string> = {
  str: "text-rose-500",
  dex: "text-amber-400",
  vit: "text-emerald-500",
  spd: "text-sky-500",
  luk: "text-yellow-500",
};

const ZERO_ALLOCATED: Record<StatKey, number> = {
  str: 0,
  dex: 0,
  vit: 0,
  spd: 0,
  luk: 0,
};

const baseCharacter = {
  className: "무직",
  level: 1,
  hp: 50,
  maxHp: 50,
  mp: 30,
  maxMp: 30,
  exp: 0,
  maxExp: 100,
  gold: 0,
  affiliation: "무소속",
  battleCount: 0,
  fame: 0,
  skills: [] as Skill[],
  stats: { str: 3, dex: 3, vit: 3, spd: 3, luk: 3 } as Record<StatKey, number>,
  equipped: {
    weapon: ITEMS.branch_stick as EquipItem | null,
    armor: ITEMS.cloth_clothes as EquipItem | null,
    accessory: ITEMS.mom_amulet as EquipItem | null,
  },
};

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

function AdventurerCard({
  character,
}: {
  character: typeof baseCharacter & { name: string };
}) {
  const items: { label: string; value: ReactNode }[] = [
    { label: "소속", value: character.affiliation },
    { label: "전투 전적", value: `${character.battleCount.toLocaleString()}회` },
    { label: "명성", value: character.fame.toLocaleString() },
    {
      label: "보유 골드",
      value: (
        <span className="inline-flex items-center gap-1">
          <Coins size={14} weight="fill" className="text-yellow-500" />
          {character.gold.toLocaleString()}
        </span>
      ),
    },
  ];
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        모험가 카드
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {items.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {label}
            </div>
            <div className="mt-0.5 text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsPanel({
  stats,
}: {
  stats: Record<StatKey, number>;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        능력치
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {STAT_KEYS.map((k) => (
          <div
            key={k}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {STAT_LABELS[k]}
            </div>
            <div className="mt-0.5 text-base font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {stats[k]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CharacterPortrait({ gender }: { gender: Gender }) {
  const [errored, setErrored] = useState(false);
  return (
    <div
      aria-label="캐릭터 이미지"
      className="flex aspect-square w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-300 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-600"
    >
      {errored ? (
        <User size={56} weight="duotone" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/images/character/${gender}.png`}
          alt=""
          onError={() => setErrored(true)}
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}

function MiniEquipCard({
  icon,
  label,
  item,
}: {
  icon: ReactNode;
  label: string;
  item: EquipItem | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const showOnHover = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setOpen(true);
  };
  const hideOnLeave = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setOpen(false);
  };
  const toggleOnTap = () => {
    if (item) setOpen((v) => !v);
  };

  return (
    <div
      ref={ref}
      className={`relative flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/50 ${
        item ? "cursor-pointer" : ""
      }`}
      onPointerEnter={item ? showOnHover : undefined}
      onPointerLeave={item ? hideOnLeave : undefined}
      onClick={toggleOnTap}
      aria-expanded={item ? open : undefined}
    >
      <span className="flex shrink-0 items-center text-zinc-700 dark:text-zinc-300">
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </div>
        <div className="truncate text-xs">
          {item ? (
            <span className="text-zinc-800 dark:text-zinc-200">{item.name}</span>
          ) : (
            <span className="italic text-zinc-400 dark:text-zinc-600">없음</span>
          )}
        </div>
      </div>

      {item && open && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-md border border-zinc-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="font-medium text-zinc-900 dark:text-zinc-100">
            {item.name}
          </div>
          <div className="mt-1.5 space-y-0.5">
            {item.stats.map((s) => (
              <div
                key={s.label}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="text-zinc-500 dark:text-zinc-400">
                  {s.label}
                </span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
          {item.description && (
            <div className="mt-2 border-t border-zinc-200 pt-2 text-xs italic text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {item.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CharacterMini({
  character,
}: {
  character: typeof baseCharacter & { name: string; gender: Gender };
}) {
  const equipped = [
    {
      icon: <Sword size={18} weight="duotone" className="text-rose-500" />,
      label: "무기",
      item: character.equipped.weapon,
    },
    {
      icon: <Shield size={18} weight="duotone" className="text-sky-500" />,
      label: "방어구",
      item: character.equipped.armor,
    },
    {
      icon: <Diamond size={18} weight="duotone" className="text-violet-500" />,
      label: "장신구",
      item: character.equipped.accessory,
    },
  ];
  return (
    <Card as="section" padding="none">
      <div className="space-y-3 p-4">
        <div className="flex items-stretch gap-4">
          <CharacterPortrait gender={character.gender} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-base font-semibold">{character.name}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {character.className}
              </span>
              <span className="text-sm text-zinc-400 dark:text-zinc-500">
                Lv.{character.level}
              </span>
            </div>
            <div className="max-w-sm space-y-2">
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
              <StatBar
                label="EXP"
                value={character.exp}
                max={character.maxExp}
                color="bg-amber-400"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {equipped.map(({ icon, label, item }) => (
            <MiniEquipCard key={label} icon={icon} label={label} item={item} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function SkillsView({ skills }: { skills: Skill[] }) {
  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<Sparkle size={40} weight="duotone" />}
        title="아직 익힌 스킬이 없습니다"
        message="모험을 통해 새로운 스킬을 배워보세요."
      />
    );
  }
  return (
    <Card as="section" padding="md">
      <ul className="space-y-2">
        {skills.map((s) => (
          <li
            key={s.name}
            className="flex items-start gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <Sparkle
              size={18}
              weight="duotone"
              className="mt-0.5 shrink-0 text-amber-500"
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {s.name}
              </div>
              {s.description && (
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {s.description}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TrainingView({
  trainingEndsAt,
  unspentPoints,
  now,
  onStartTraining,
  onAllocateStat,
}: {
  trainingEndsAt: number | null;
  unspentPoints: number;
  now: number;
  onStartTraining: () => void;
  onAllocateStat: (key: StatKey) => void;
}) {
  const remaining = trainingEndsAt ? Math.max(0, trainingEndsAt - now) : 0;
  const isTraining = !!trainingEndsAt && remaining > 0;
  const canAllocate = unspentPoints > 0;

  return (
    <Card as="section" padding="lg">
      <div className="space-y-6">
        <button
          type="button"
          onClick={onStartTraining}
          disabled={isTraining}
          className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-4 py-3 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {isTraining
            ? `훈련 중 · ${formatDuration(remaining)}`
            : "4시간 훈련 시작"}
        </button>

        <div>
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span>스탯 단련</span>
            <span className="tabular-nums">단련 포인트 {unspentPoints}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STAT_KEYS.map((k) => {
              const Icon = STAT_ICONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onAllocateStat(k)}
                  disabled={!canAllocate}
                  className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-base transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
                >
                  <Icon
                    size={22}
                    weight="duotone"
                    className={`shrink-0 ${STAT_ICON_COLORS[k]}`}
                  />
                  <span className="flex-1 text-left font-medium text-zinc-700 dark:text-zinc-200">
                    {STAT_LABELS[k]} 단련
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                    +1
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}


export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<TabKey>("adventure");
  const [subView, setSubView] = useState<string | null>(null);
  const [trainingEndsAt, setTrainingEndsAt] = useState<number | null>(null);
  const [unspentPoints, setUnspentPoints] = useState(0);
  const [allocatedStats, setAllocatedStats] =
    useState<Record<StatKey, number>>(ZERO_ALLOCATED);
  const [now, setNow] = useState(() => Date.now());
  const [mapProgress, setMapProgress] =
    useState<MapProgress>(initialMapProgress);
  const [characterState, setCharacterState] =
    useState<CharacterDynamicState>(initialCharacterState);
  const [autoBattle, setAutoBattle] = useState(false);
  const regionInitRanRef = useRef(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  const adventureLog = useAdventureLog();
  const quests = useQuests();
  const crafting = useCrafting();
  const inventory = useInventory();
  const autoPotion = useAutoPotionConfig();

  useEffect(() => {
    try {
      // 신규 키가 비어 있으면 옛 키(`characterProfile.v1` 등)에서 한 번 옮겨온 뒤 정리.
      let raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) {
        for (const key of LEGACY_PROFILE_KEYS) {
          const legacy = localStorage.getItem(key);
          if (legacy) {
            raw = legacy;
            localStorage.setItem(PROFILE_STORAGE_KEY, legacy);
            break;
          }
        }
      }
      for (const key of LEGACY_PROFILE_KEYS) localStorage.removeItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Profile>;
        if (
          parsed?.name &&
          (parsed.gender === "male" || parsed.gender === "female")
        ) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setProfile({ name: parsed.name, gender: parsed.gender });
        }
      }
    } catch {}

    try {
      const raw = localStorage.getItem(TRAINING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          endsAt?: number | null;
          points?: number;
          allocated?: Partial<Record<StatKey, number>>;
        };
        setTrainingEndsAt(parsed.endsAt ?? null);
        setUnspentPoints(parsed.points ?? 0);
        setAllocatedStats({ ...ZERO_ALLOCATED, ...parsed.allocated });
      }
    } catch {}

    setMapProgress(loadMapProgress());

    try {
      const raw = localStorage.getItem(CHARACTER_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CharacterDynamicState>;
        setCharacterState({
          hp: parsed.hp ?? initialCharacterState.hp,
          mp: parsed.mp ?? initialCharacterState.mp,
          level: Math.min(
            MAX_LEVEL,
            Math.max(1, parsed.level ?? initialCharacterState.level),
          ),
          exp: parsed.exp ?? initialCharacterState.exp,
          gold: parsed.gold ?? initialCharacterState.gold,
          fame: parsed.fame ?? initialCharacterState.fame,
          equipped: parsed.equipped,
        });
      }
    } catch {}

    try {
      const raw = localStorage.getItem(BATTLE_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { auto?: boolean };
        setAutoBattle(!!parsed.auto);
      }
    } catch {}

    const stored = loadNotifications();
    setNotifications(stored.list);
    setLastReadAt(stored.lastReadAt);

    setHydrated(true);
  }, []);

  // 알림 영속
  useEffect(() => {
    if (!hydrated) return;
    saveNotifications({ list: notifications, lastReadAt });
  }, [hydrated, notifications, lastReadAt]);

  // 캐릭터 변동 상태 영속
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CHARACTER_STATE_KEY, JSON.stringify(characterState));
    } catch {}
  }, [hydrated, characterState]);

  // 자동 전투 토글 영속
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        BATTLE_SETTINGS_KEY,
        JSON.stringify({ auto: autoBattle }),
      );
    } catch {}
  }, [hydrated, autoBattle]);

  // region 이동 시 자동 전투 강제 OFF (첫 mount 시엔 스킵)
  useEffect(() => {
    if (!regionInitRanRef.current) {
      regionInitRanRef.current = true;
      return;
    }
    setAutoBattle(false);
  }, [mapProgress.currentRegionId]);

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

  // 훈련 진행 중일 때만 1초 단위로 now 갱신
  useEffect(() => {
    if (!trainingEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [trainingEndsAt]);

  // 훈련 종료 시점 도달 시 자동 적립 (페이지 로드 직후 / 탭 사용 중 모두 처리)
  useEffect(() => {
    if (trainingEndsAt && now >= trainingEndsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnspentPoints((p) => p + 1);
      setTrainingEndsAt(null);
    }
  }, [trainingEndsAt, now]);

  // hydration 이후에만 변경 사항을 localStorage에 저장 (초기 덮어쓰기 방지)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        TRAINING_STORAGE_KEY,
        JSON.stringify({
          endsAt: trainingEndsAt,
          points: unspentPoints,
          allocated: allocatedStats,
        }),
      );
    } catch {}
  }, [hydrated, trainingEndsAt, unspentPoints, allocatedStats]);

  const handleProfileSubmit = (next: Profile) => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
    } catch {}
    setProfile(next);
  };

  const handleStartTraining = () => {
    if (trainingEndsAt) return;
    setTrainingEndsAt(Date.now() + TRAINING_DURATION_MS);
    setNow(Date.now());
  };

  const handleAllocateStat = (key: StatKey) => {
    if (unspentPoints <= 0) return;
    setAllocatedStats((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    setUnspentPoints((p) => p - 1);
  };

  const handleTabChange = (next: TabKey) => {
    setTab(next);
    setSubView(null);
  };

  const trainingRemaining = trainingEndsAt
    ? Math.max(0, trainingEndsAt - now)
    : 0;
  const isTraining = !!trainingEndsAt && trainingRemaining > 0;
  const trainingDescription = isTraining
    ? `훈련 중 · ${formatDuration(trainingRemaining)}`
    : unspentPoints > 0
      ? `단련 포인트 ${unspentPoints}개 보유`
      : "능력치를 단련할 수 있는 곳.";

  const equippedSlots = characterState.equipped ?? baseCharacter.equipped;
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

  const character = {
    ...baseCharacter,
    name: profile?.name ?? DEFAULT_NAME,
    gender: profile?.gender ?? "male",
    hp: Math.min(characterState.hp, baseCharacter.maxHp),
    mp: Math.min(characterState.mp, baseCharacter.maxMp),
    level: characterState.level,
    exp: characterState.exp,
    maxExp: requiredExpToNext(characterState.level) ?? 0,
    gold: characterState.gold,
    fame: characterState.fame,
    equipped: equippedSlots,
    stats: STAT_KEYS.reduce<Record<StatKey, number>>(
      (acc, k) => {
        acc[k] =
          baseCharacter.stats[k] + allocatedStats[k] + equipStatBonuses[k];
        return acc;
      },
      {} as Record<StatKey, number>,
    ),
  };
  const showModal = hydrated && !profile;
  const currentRegion =
    WORLD_MAP.regions.find((r) => r.id === mapProgress.currentRegionId) ??
    WORLD_MAP.regions[0];
  const isTown = currentRegion.tags?.includes("town") ?? false;

  useEffect(() => {
    adventureLog.markRegionVisited(currentRegion.id);
  }, [currentRegion.id, adventureLog]);

  // 레벨업 감지 — character.level 증가 시 스탯 포인트 지급 + 알림.
  // 초기 로드(localStorage 동기화)는 무시하기 위해 ref가 null이면 베이스라인만 기록.
  const lastSeenLevelRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastSeenLevelRef.current === null) {
      lastSeenLevelRef.current = characterState.level;
      return;
    }
    const prev = lastSeenLevelRef.current;
    const next = characterState.level;
    if (next > prev) {
      const gained = next - prev;
      setUnspentPoints((p) => p + gained);
      addNotification(
        "info",
        `레벨업! Lv.${next} (스탯 포인트 +${gained})`,
      );
    }
    lastSeenLevelRef.current = next;
    // addNotification은 setter만 사용하므로 deps에서 제외 — eslint 비활성.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterState.level]);

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
  //   힘   STR : +2 atk / pt
  //   민첩 DEX : +1% 회피 / pt
  //   활력 VIT : +2 def / pt
  //   속도 SPD : 10pt 당 공격 횟수 +1 (베이스 1회)
  //   행운 LUK : +1% 드랍률 / pt (드랍 시스템 도입 시 사용)
  const playerCombat = {
    hp: character.hp,
    maxHp: character.maxHp,
    atk: character.stats.str * 2 + equipAtk,
    def: character.stats.vit * 2 + equipDef,
    spd: character.stats.spd,
    evasionPct: character.stats.dex,
    attackCount: 1 + Math.floor(character.stats.spd / 10),
  };

  // 자동 전투 — 카테고리 단위 규칙 평가. 회복량 작은 물약부터 소진해 큰 것을 아낌.
  // 인벤토리 차감은 호출 측(BattleView)에서.
  const pickAutoAction = (state: BattleState): PlayerAction => {
    for (const rule of autoPotion.config.rules) {
      if (!rule.enabled) continue;
      if (state.playerHp >= state.playerMaxHp) continue;

      let triggered = false;
      if (rule.trigger.kind === "hp_below_pct") {
        const hpPct = (state.playerHp / state.playerMaxHp) * 100;
        if (hpPct < rule.trigger.pct) triggered = true;
      }
      if (!triggered) continue;

      const candidates = POTION_IDS.filter((id) => {
        const p = POTIONS[id];
        if (rule.target === "hp_heal" && p.effect.kind !== "heal_hp") return false;
        return (inventory.state.potions[id] ?? 0) > 0;
      }).sort(
        (a, b) =>
          computeHealAmount(POTIONS[a], state.playerMaxHp) -
          computeHealAmount(POTIONS[b], state.playerMaxHp),
      );

      for (const id of candidates) {
        return { kind: "use_potion", potionId: id, potion: POTIONS[id] };
      }
    }
    return { kind: "attack" };
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
    setCharacterState((prev) => ({ ...prev, gold: prev.gold - cost }));
    inventory.add(id, buyQty);
  };

  const handlePurchaseMaterial = (id: MaterialId, quantity: number) => {
    const m = MATERIALS[id];
    if (!m) return;
    const cost = m.price * quantity;
    if (characterState.gold < cost) return;
    setCharacterState((prev) => ({ ...prev, gold: prev.gold - cost }));
    inventory.addMaterial(id, quantity);
  };

  const addNotification = (kind: NotificationKind, text: string) => {
    const notif: AppNotification = {
      id: genNotificationId(),
      timestamp: Date.now(),
      kind,
      text,
    };
    setNotifications((prev) => [notif, ...prev].slice(0, MAX_NOTIFICATIONS));
  };

  const handleNotificationsOpen = () => {
    setLastReadAt(Date.now());
  };

  // 장비 교체 — 기존에 장착돼 있던 아이템은 인벤토리로 회수.
  // ITEMS 사전에 등록된 아이템만 회수 가능 (이름 기반 역추적).
  const equipItem = (
    slot: "weapon" | "armor" | "accessory",
    item: EquipItem,
  ) => {
    setCharacterState((prev) => {
      const current = prev.equipped ?? baseCharacter.equipped;
      const oldId = findItemId(current[slot]);
      if (oldId) inventory.addEquipment(oldId, 1);
      return {
        ...prev,
        equipped: { ...current, [slot]: item },
      };
    });
  };

  // 인벤토리에서 장비를 꺼내 장착. 보유분에서 1개 차감, 기존 장비는 회수.
  const handleEquipFromInventory = (id: ItemId) => {
    if (!inventory.consumeEquipment(id, 1)) return;
    const item = ITEMS[id];
    equipItem(item.slot, item);
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

  const renderTrainerDialogue = (npc: Npc, close: () => void) => {
    const slime = quests.getEntry("village-trainer-slimes");
    const dogs = quests.getEntry("village-trainer-dogs");
    const moles = quests.getEntry("village-trainer-moles");

    // === 슬라임 단계 ===
    if (slime.state === "available") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            "훈련이 필요해서 왔는가?\n일단 평야로 가서 슬라임 5마리를 잡고 돌아오게."
          }
          primaryAction={{
            label: "받아들인다",
            onClick: () => {
              quests.accept("village-trainer-slimes");
              close();
            },
          }}
        />
      );
    }
    if (slime.state === "active") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            `슬라임은 잘 잡고 있나?\n평야에 가면 흔하지. — 진행 ${slime.progress}/5`
          }
        />
      );
    }
    if (slime.state === "ready") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            "오, 다섯 마리를 다 잡아왔군.\n잘 했네 — 자, 보상이다. 작은 회복약 다섯 개와 조합법.\n모험을 하려면 포션 정도는 만들 줄 알아야 할걸세."
          }
          primaryAction={{
            label: "보상을 받는다",
            onClick: () => {
              if (completeQuest("village-trainer-slimes")) close();
            },
          }}
        />
      );
    }

    // === 들개 단계 (슬라임 완료 후) ===
    if (dogs.state === "available") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            "슬라임은 얌전한 편이지.\n다음은 들개다 — 평야와 외곽 숲에서 떼지어 다닌다.\n10마리만 잡아와. 어금니가 부딪치는 소리가 익숙해져야 해."
          }
          primaryAction={{
            label: "받아들인다",
            onClick: () => {
              quests.accept("village-trainer-dogs");
              close();
            },
          }}
        />
      );
    }
    if (dogs.state === "active") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            `들개는 빠르고 사나워.\n자세를 낮추고 발을 노려라. — 진행 ${dogs.progress}/10`
          }
        />
      );
    }
    if (dogs.state === "ready") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            "들개의 눈빛이 익숙해졌나?\n잘 했네. — 그럼 마지막 단련만 남았다."
          }
          primaryAction={{
            label: "보고한다",
            onClick: () => {
              if (completeQuest("village-trainer-dogs")) close();
            },
          }}
        />
      );
    }

    // === 두더쥐 단계 (들개 완료 후) ===
    if (moles.state === "available") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            "두더쥐를 우습게 보면 안 돼.\n땅 밑으로 들락거리며 빠르게 친다.\n10마리. 어디로 들어가는지, 어디로 나오는지 — 그걸 보는 눈을 길러봐."
          }
          primaryAction={{
            label: "받아들인다",
            onClick: () => {
              quests.accept("village-trainer-moles");
              close();
            },
          }}
        />
      );
    }
    if (moles.state === "active") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            `두더쥐는 보이지 않을 때가 더 위험하지.\n흙 위의 떨림을 읽어라. — 진행 ${moles.progress}/10`
          }
        />
      );
    }
    if (moles.state === "ready") {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            "훌륭해. 슬라임, 들개, 두더쥐 — 평야의 셋을 다 끝냈군.\n자, 이건 내가 신참 시절 주워 모은 거다. 활력의 반지. 끼고 다녀라."
          }
          primaryAction={{
            label: "활력의 반지를 받는다",
            onClick: () => {
              if (completeQuest("village-trainer-moles")) close();
            },
          }}
        />
      );
    }

    // 모든 단련 완료 후 일상 대화.
    return (
      <NpcDialogue
        npc={npc}
        onClose={close}
        text={
          "또 왔구나.\n이제 평야는 졸업이지. 한 단계 더 위로 나아가 봐."
        }
      />
    );
  };

  const renderBoldDialogue = (npc: Npc, close: () => void) => {
    const knowsBat = crafting.knows("baseball_bat");
    const craftedBat = crafting.hasCrafted("baseball_bat");
    const armorReceived = crafting.state.boldQuestComplete;
    const slimeQuestDone = crafting.state.boldSlimeQuestComplete;
    const hasSlimeCore = inventory.materialCount("slime_core") > 0;

    // Stage A — 처음. 제작서 주기.
    if (!knowsBat) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            "처음 보는데… 모험가인가?\n그 나뭇가지 들고 마을 밖으로 나가는 건 위험하네.\n자, 받아 — 야구 방망이 제작서다. 대장간에 가서 직접 만들어 봐."
          }
          primaryAction={{
            label: "제작서를 받는다",
            onClick: () => {
              crafting.learnRecipe("baseball_bat");
              close();
            },
          }}
        />
      );
    }

    // Stage B — 제작서를 받았지만 아직 안 만듦.
    if (!craftedBat) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            "방망이는 잘 만들고 있나?\n대장간 앞에서 망설이지 말게. 제작서대로 두드리면 되네."
          }
        />
      );
    }

    // Stage C — 만들어 옴. 가죽갑옷 주기.
    if (!armorReceived) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            "오, 제대로 만들었군!\n…그런 천 옷으로 어딜 다녀. 이거도 챙겨가라 — 낡은 가죽갑옷이지만, 그쪽 천 쪼가리보단 백 배 낫지."
          }
          primaryAction={{
            label: "낡은 가죽갑옷을 받는다",
            onClick: () => {
              inventory.addEquipment("old_leather_armor");
              crafting.setBoldQuestComplete();
              addNotification(
                "quest_complete",
                `${STORY_QUESTS.bold_blacksmith_intro.title} 완료`,
              );
              close();
            },
          }}
        />
      );
    }

    // Stage D — 슬라임 핵을 들고 오면 1회성. 제작법을 받음(핵은 소모 X).
    if (armorReceived && !slimeQuestDone && hasSlimeCore) {
      return (
        <NpcDialogue
          npc={npc}
          onClose={close}
          text={
            "어, 이건… 슬라임 핵 아닌가?\n이걸로 꽤 괜찮은 방어구를 만들 수 있다네. 내가 장비 제조법을 주지 — 슬라임 조각도 함께 챙겨서 대장간으로 오게."
          }
          primaryAction={{
            label: "제조법을 받는다",
            onClick: () => {
              crafting.learnRecipe("squishy_armor");
              crafting.setBoldSlimeQuestComplete();
              addNotification(
                "quest_complete",
                `${STORY_QUESTS.bold_slime_core.title} 완료`,
              );
              close();
            },
          }}
        />
      );
    }

    // Stage E — 끝. 일상 대화.
    return (
      <NpcDialogue
        npc={npc}
        onClose={close}
        text={
          "왔구나.\n잘 지내고 있나? 무기 손볼 일 있으면 또 들르게."
        }
      />
    );
  };

  const handleHeal = () => {
    setCharacterState((prev) => ({
      ...prev,
      hp: baseCharacter.maxHp,
      mp: baseCharacter.maxMp,
    }));
  };

  const handleBattleEnd = (payload: BattleEndPayload) => {
    if (payload.outcome === "win") {
      adventureLog.addKill(payload.enemyName);
      const readyQuestIds = quests.recordKill(payload.enemyName);
      setCharacterState((prev) => {
        const next = applyExpGain(prev.level, prev.exp, payload.rewards.exp);
        return {
          ...prev,
          hp: payload.finalPlayerHp,
          level: next.level,
          exp: next.exp,
        };
      });
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
      // 패배 — HP 회복 + 시작 마을 강제 이동 + 자동 전투 OFF
      setCharacterState((prev) => ({ ...prev, hp: baseCharacter.maxHp }));
      setMapProgress((prev) => ({
        currentRegionId: START_REGION_ID,
        visitedRegionIds: prev.visitedRegionIds.includes(START_REGION_ID)
          ? prev.visitedRegionIds
          : [...prev.visitedRegionIds, START_REGION_ID],
      }));
      setAutoBattle(false);
      addNotification(
        "battle_lose",
        `${payload.enemyName}에게 쓰러졌다... 시작 마을로 돌아왔다.`,
      );
    }
  };

  const handleAcceptQuest = (id: string) => {
    quests.accept(id);
  };

  const rewardServices: RewardServices = {
    addPotion: (id, n) => inventory.add(id, n),
    addMaterial: (id, n) => inventory.addMaterial(id, n),
    addEquipment: (id) => inventory.addEquipment(id),
    learnRecipe: (id) => crafting.learnRecipe(id),
    addGoldFame: (gold, fame) =>
      setCharacterState((prev) => ({
        ...prev,
        gold: prev.gold + gold,
        fame: prev.fame + fame,
      })),
    addExp: (n) =>
      setCharacterState((prev) => {
        const next = applyExpGain(prev.level, prev.exp, n);
        return { ...prev, level: next.level, exp: next.exp };
      }),
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

  // 알림(종·토스트)은 의미 있는 종류만 — battle_win·info는 최근 기록에만 남김.
  // (quest_complete은 alertable — 토스트/종에 표시.)
  const alertableNotifications = notifications.filter(
    (n) => n.kind !== "battle_win" && n.kind !== "info",
  );
  const unreadCount = alertableNotifications.filter(
    (n) => n.timestamp > lastReadAt,
  ).length;

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
              notifications={alertableNotifications}
              unreadCount={unreadCount}
              onOpen={handleNotificationsOpen}
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
                  if (npc.id === "village_blacksmith_bold")
                    return renderBoldDialogue(npc, close);
                  if (npc.id === "village_trainer_smith")
                    return renderTrainerDialogue(npc, close);
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
                autoBattle={autoBattle}
                onAutoBattleChange={setAutoBattle}
                onBattleStart={adventureLog.markEncountered}
                onBattleEnd={handleBattleEnd}
                potionCounts={inventory.state.potions}
                consumePotion={inventory.consume}
                pickAutoAction={pickAutoAction}
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
                  onClick={handleHeal}
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
                trainingEndsAt={trainingEndsAt}
                unspentPoints={unspentPoints}
                now={now}
                onStartTraining={handleStartTraining}
                onAllocateStat={handleAllocateStat}
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
                  notifications.length > 0
                    ? `최근 알림 ${notifications.length}개`
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
                notifications={notifications}
                onClear={() => {
                  setNotifications([]);
                  setLastReadAt(Date.now());
                }}
              />
            </div>
          )}
        </main>
      </div>
      <NotificationToast notifications={alertableNotifications} />
      {showModal && <NameSetupModal onSubmit={handleProfileSubmit} />}
    </>
  );
}
