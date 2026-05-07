"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Barbell,
  CaretRight,
  Coins,
  Compass,
  Diamond,
  Hammer,
  MapPin,
  Scroll,
  Shield,
  Sparkle,
  Sword,
  User,
} from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NameSetupModal, type Gender } from "@/components/NameSetupModal";
import { MapView } from "@/adventure/MapView";
import { BattleView } from "@/adventure/BattleView";
import { TownView } from "@/adventure/TownView";
import { WORLD_MAP } from "@/adventure/data/world";
import {
  initialMapProgress,
  loadMapProgress,
  saveMapProgress,
  type MapProgress,
} from "@/lib/map-progress";

const PROFILE_STORAGE_KEY = "characterProfile.v1";
const LEGACY_PROFILE_KEYS = ["characterName", "characterName.v2"];
const DEFAULT_NAME = "모험가";

type Profile = { name: string; gender: Gender };

const TRAINING_STORAGE_KEY = "training.v1";
const TRAINING_DURATION_MS = 4 * 60 * 60 * 1000;

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

type EquipItem = {
  name: string;
  stats: { label: string; value: string }[];
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
      description: "어디서나 주울 수 있는 평범한 나뭇가지.",
    } as EquipItem | null,
    armor: {
      name: "천 옷",
      stats: [{ label: "방어력", value: "+1" }],
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
    <section className="rounded-lg border border-zinc-200 bg-white/40 dark:border-zinc-800 dark:bg-zinc-950/40">
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
      className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white/40 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900/40"
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
        className="-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
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
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white/40 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
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
    <section className="rounded-lg border border-zinc-200 bg-white/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
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
    <section className="rounded-lg border border-zinc-200 bg-white/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="space-y-4">
        <button
          type="button"
          onClick={onStartTraining}
          disabled={isTraining}
          className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {isTraining
            ? `훈련 중 · ${formatDuration(remaining)}`
            : "4시간 훈련 시작"}
        </button>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span>스탯 단련</span>
            <span className="tabular-nums">단련 포인트 {unspentPoints}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STAT_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onAllocateStat(k)}
                disabled={!canAllocate}
                className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
              >
                <span className="text-zinc-700 dark:text-zinc-300">
                  {STAT_LABELS[k]} 단련
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {canAllocate ? "+1" : "포인트 없음"}
                </span>
              </button>
            ))}
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
  const [currentLocation] = useState<string>("고향 마을");
  const [trainingEndsAt, setTrainingEndsAt] = useState<number | null>(null);
  const [unspentPoints, setUnspentPoints] = useState(0);
  const [allocatedStats, setAllocatedStats] =
    useState<Record<StatKey, number>>(ZERO_ALLOCATED);
  const [now, setNow] = useState(() => Date.now());
  const [mapProgress, setMapProgress] =
    useState<MapProgress>(initialMapProgress);

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
    setHydrated(true);
  }, []);

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

  return (
    <>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-6 dark:border-zinc-800">
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
                {currentLocation}
              </span>
            </span>
          </div>
          <ThemeToggle />
        </header>

        <TabBar active={tab} onChange={handleTabChange} />

        <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6">
          {tab === "adventure" && subView === null && (
            <>
              <CharacterMini character={character} />
              <div className="space-y-2">
                {currentRegion.tags?.includes("town") ? (
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
                    onClick={() => setSubView("battle")}
                  />
                ) : (
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
          {tab === "adventure" && subView === "battle" && (
            <div className="space-y-3">
              <SubViewHeader
                title={
                  currentRegion.tags?.includes("town")
                    ? currentRegion.name
                    : "전투"
                }
                onBack={() => setSubView(null)}
              />
              {currentRegion.tags?.includes("town") ? (
                <TownView region={currentRegion} />
              ) : (
                <BattleView region={currentRegion} />
              )}
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

          {tab === "town" && subView === null && (
            <div className="space-y-2">
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
          {tab === "town" && subView === "training" && (
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
          {tab === "town" && subView === "crafting" && (
            <div className="space-y-3">
              <SubViewHeader title="제작소" onBack={() => setSubView(null)} />
              <section className="rounded-lg border border-dashed border-zinc-300 bg-white/40 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
                <div className="text-base font-medium text-zinc-700 dark:text-zinc-300">
                  준비 중
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  곧 제작 메뉴가 열립니다.
                </div>
              </section>
            </div>
          )}
          {tab === "town" && subView === "guild" && (
            <div className="space-y-3">
              <SubViewHeader
                title="모험가 길드"
                onBack={() => setSubView(null)}
              />
              <section className="rounded-lg border border-dashed border-zinc-300 bg-white/40 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
                <Scroll
                  size={40}
                  weight="duotone"
                  className="mx-auto text-yellow-700"
                />
                <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
                  준비 중
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  곧 의뢰 게시판이 열립니다.
                </div>
              </section>
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
            </div>
          )}
          {tab === "character" && subView === "info" && (
            <div className="space-y-3">
              <SubViewHeader title="내 정보" onBack={() => setSubView(null)} />
              <CharacterMini character={character} />
              <section className="rounded-lg border border-zinc-200 bg-white/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
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
        </main>
      </div>
      {showModal && <NameSetupModal onSubmit={handleProfileSubmit} />}
    </>
  );
}
