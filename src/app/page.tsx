"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Barbell,
  BookOpen,
  CaretRight,
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
import {
  genNotificationId,
  loadNotifications,
  saveNotifications,
  MAX_NOTIFICATIONS,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";

const PROFILE_STORAGE_KEY = "characterProfile.v1";
const LEGACY_PROFILE_KEYS = ["characterName", "characterName.v2"];
const DEFAULT_NAME = "모험가";

type Profile = { name: string; gender: Gender };

const TRAINING_STORAGE_KEY = "training.v1";
const TRAINING_DURATION_MS = 4 * 60 * 60 * 1000;

const CHARACTER_STATE_KEY = "character.v1";
const BATTLE_SETTINGS_KEY = "battle-settings.v1";

type CharacterDynamicState = {
  hp: number;
  mp: number;
  exp: number;
  gold: number;
  fame: number;
};

const initialCharacterState: CharacterDynamicState = {
  hp: 50,
  mp: 30,
  exp: 0,
  gold: 0,
  fame: 0,
};

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export type EquipBonus = {
  atk?: number;
  def?: number;
};

type EquipItem = {
  name: string;
  stats: { label: string; value: string }[];
  bonus?: EquipBonus;
  description?: string;
};

type Skill = {
  name: string;
  description?: string;
};

const STAT_KEYS = ["str", "dex", "vit", "spd", "luk"] as const;
type StatKey = (typeof STAT_KEYS)[number];

const STAT_LABELS: Record<StatKey, string> = {
  str: "힘",
  dex: "민첩",
  vit: "활력",
  spd: "속도",
  luk: "행운",
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
    weapon: {
      name: "나뭇가지",
      stats: [{ label: "공격력", value: "+0" }],
      bonus: { atk: 0 },
      description: "어디서나 주울 수 있는 평범한 나뭇가지.",
    } as EquipItem | null,
    armor: {
      name: "천 옷",
      stats: [{ label: "방어력", value: "+1" }],
      bonus: { def: 1 },
      description: "평범한 천으로 만든 옷.",
    } as EquipItem | null,
    accessory: {
      name: "엄마가 준 부적",
      stats: [{ label: "행운", value: "+3" }],
      description: "어머니의 사랑이 깃든 작은 부적.",
    } as EquipItem | null,
  },
};

function StatBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-10 shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
        {value}/{max}
      </span>
    </div>
  );
}

type TabKey = "adventure" | "town" | "character";

const TABS: { key: TabKey; label: string }[] = [
  { key: "adventure", label: "모험" },
  { key: "town", label: "마을" },
  { key: "character", label: "캐릭터" },
];

function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (next: TabKey) => void;
}) {
  return (
    <nav
      role="tablist"
      aria-label="메인 탭"
      className="mx-auto flex w-full max-w-2xl gap-1 border-b border-zinc-200 px-4 sm:px-6 dark:border-zinc-800"
    >
      {TABS.map((t) => {
        const selected = active === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onChange(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-base font-semibold transition-colors ${
              selected
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
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

function RegionBackground({
  regionId,
  imageOverride,
}: {
  regionId: string;
  imageOverride?: string;
}) {
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrored(false);
  }, [regionId, imageOverride]);
  if (errored) return null;
  const src = imageOverride ?? `/images/ui/${regionId}.png`;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onError={() => setErrored(true)}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-zinc-50/85 dark:bg-zinc-950/80" />
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
    <section className="rounded-lg border border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90">
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
    </section>
  );
}

function EntryCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white/90 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/90 dark:hover:bg-zinc-900/80"
    >
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center text-zinc-700 dark:text-zinc-200"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </span>
        <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
      <CaretRight
        size={16}
        weight="bold"
        aria-hidden
        className="shrink-0 text-zinc-400 dark:text-zinc-500"
      />
    </button>
  );
}

function SubViewHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <ArrowLeft size={16} weight="bold" />
        뒤로
      </button>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
    </div>
  );
}

function SkillsView({ skills }: { skills: Skill[] }) {
  if (skills.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/90">
        <Sparkle
          size={40}
          weight="duotone"
          className="mx-auto text-zinc-400 dark:text-zinc-500"
        />
        <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
          아직 익힌 스킬이 없습니다
        </div>
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          모험을 통해 새로운 스킬을 배워보세요.
        </div>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-zinc-200 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/90">
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
    </section>
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
    <section className="rounded-lg border border-zinc-200 bg-white/90 p-6 dark:border-zinc-800 dark:bg-zinc-950/90">
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
    </section>
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

  useEffect(() => {
    try {
      for (const key of LEGACY_PROFILE_KEYS) localStorage.removeItem(key);
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
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
          exp: parsed.exp ?? initialCharacterState.exp,
          gold: parsed.gold ?? initialCharacterState.gold,
          fame: parsed.fame ?? initialCharacterState.fame,
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

  const character = {
    ...baseCharacter,
    name: profile?.name ?? DEFAULT_NAME,
    gender: profile?.gender ?? "male",
    hp: Math.min(characterState.hp, baseCharacter.maxHp),
    mp: Math.min(characterState.mp, baseCharacter.maxMp),
    exp: characterState.exp,
    gold: characterState.gold,
    fame: characterState.fame,
    stats: STAT_KEYS.reduce<Record<StatKey, number>>(
      (acc, k) => {
        acc[k] = baseCharacter.stats[k] + allocatedStats[k];
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
    if (tab === "adventure" && subView === "town" && isTown) {
      adventureLog.markTownVisited(currentRegion.id);
    }
  }, [tab, subView, isTown, currentRegion.id, adventureLog]);

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
  const playerCombat = {
    hp: character.hp,
    maxHp: character.maxHp,
    atk: character.stats.str + equipAtk,
    def: equipDef,
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

  const handleHeal = () => {
    setCharacterState((prev) => ({
      ...prev,
      hp: baseCharacter.maxHp,
      mp: baseCharacter.maxMp,
    }));
    addNotification("info", "치유소에서 체력과 마력을 회복했다.");
  };

  const handleBattleEnd = (payload: BattleEndPayload) => {
    if (payload.outcome === "win") {
      adventureLog.addKill(payload.enemyName);
      quests.recordKill(payload.enemyName);
      setCharacterState((prev) => ({
        ...prev,
        hp: payload.finalPlayerHp,
        exp: prev.exp + payload.rewards.exp,
      }));
      const reward =
        payload.rewards.exp > 0 ? `EXP +${payload.rewards.exp}` : "보상 없음";
      addNotification(
        "battle_win",
        `${payload.enemyName}을(를) 쓰러뜨렸다 — ${reward}`,
      );
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

  const handleClaimQuest = (id: string) => {
    const result = quests.claim(id);
    if (!result.ok) return;
    const { quest } = result;
    setCharacterState((prev) => ({
      ...prev,
      gold: prev.gold + quest.reward.gold,
      fame: prev.fame + quest.reward.fame,
    }));
    addNotification(
      "info",
      `의뢰 완료 — ${quest.title} (골드 +${quest.reward.gold}, 명성 +${quest.reward.fame})`,
    );
  };

  // 알림(종·토스트)은 의미 있는 종류만 — battle_win·info는 최근 기록에만 남김.
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

        <TabBar active={tab} onChange={handleTabChange} />

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
              />
            </div>
          )}
          {tab === "adventure" && subView === "map" && (
            <div className="space-y-3">
              <SubViewHeader title="지도" onBack={() => setSubView(null)} />
              <MapView
                progress={mapProgress}
                onProgressChange={setMapProgress}
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
                  <Barbell
                    size={28}
                    weight="duotone"
                    className="text-orange-500"
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
                title="제작소"
                description="장비와 도구를 직접 만들 수 있는 곳."
                onClick={() => setSubView("crafting")}
              />
              <EntryCard
                icon={
                  <Scroll
                    size={28}
                    weight="duotone"
                    className="text-yellow-700"
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
              <section className="rounded-lg border border-zinc-200 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/90">
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
              </section>
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
              <SubViewHeader title="제작소" onBack={() => setSubView(null)} />
              <section className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/90">
                <div className="text-base font-medium text-zinc-700 dark:text-zinc-300">
                  준비 중
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  곧 제작 메뉴가 열립니다.
                </div>
              </section>
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
              <section className="rounded-lg border border-zinc-200 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/90">
                <div className="space-y-4">
                  <AdventurerCard character={character} />
                  <div className="border-t border-zinc-200 dark:border-zinc-800" />
                  <StatsPanel stats={character.stats} />
                </div>
              </section>
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
              <AdventureLogView log={adventureLog.log} />
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
