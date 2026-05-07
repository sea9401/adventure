"use client";

import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NameSetupModal } from "@/components/NameSetupModal";

const NAME_STORAGE_KEY = "characterName.v2";
const LEGACY_NAME_KEYS = ["characterName"];
const DEFAULT_NAME = "모험가";

type EquipItem = {
  name: string;
  stats: { label: string; value: string }[];
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

const baseCharacter = {
  className: "무직",
  level: 1,
  hp: 50,
  maxHp: 50,
  mp: 30,
  maxMp: 30,
  gold: 0,
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
      <span className="w-8 shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>
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

function EquipCard({ title, item }: { title: string; item: EquipItem | null }) {
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
      className={`relative rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/50 ${
        item ? "cursor-pointer" : ""
      }`}
      onPointerEnter={item ? showOnHover : undefined}
      onPointerLeave={item ? hideOnLeave : undefined}
      onClick={toggleOnTap}
      aria-expanded={item ? open : undefined}
    >
      <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {title}
      </div>
      <div className="mt-1 text-base">
        {item ? (
          <span className="text-zinc-900 dark:text-zinc-100">{item.name}</span>
        ) : (
          <span className="italic text-zinc-400 dark:text-zinc-600">없음</span>
        )}
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
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
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

function CharacterPanel({
  character,
}: {
  character: typeof baseCharacter & { name: string };
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white/40 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-semibold">{character.name}</span>
          <span className="text-base text-zinc-500 dark:text-zinc-400">
            {character.className}
          </span>
          <span className="text-base text-zinc-400 dark:text-zinc-500">
            Lv.{character.level}
          </span>
        </div>

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

        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">골드</span>
          <span className="tabular-nums">
            💰 {character.gold.toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
          <EquipCard title="무기" item={character.equipped.weapon} />
          <EquipCard title="방어구" item={character.equipped.armor} />
          <EquipCard title="장신구" item={character.equipped.accessory} />
        </div>
      </div>
    </section>
  );
}

function StatsPanel({
  stats,
}: {
  stats: Record<StatKey, number>;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white/40 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="p-4">
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
    </section>
  );
}

function CharacterMini({
  character,
}: {
  character: typeof baseCharacter & { name: string };
}) {
  const equipped = [
    { icon: "🗡️", label: "무기", item: character.equipped.weapon },
    { icon: "🛡️", label: "방어구", item: character.equipped.armor },
    { icon: "💍", label: "장신구", item: character.equipped.accessory },
  ];
  return (
    <section className="rounded-lg border border-zinc-200 bg-white/40 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="space-y-1.5 px-3 py-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-semibold">{character.name}</span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {character.className}
          </span>
          <span className="text-sm text-zinc-400 dark:text-zinc-500">
            Lv.{character.level}
          </span>
        </div>
        <div className="max-w-xs space-y-1.5">
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
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          {equipped.map(({ icon, label, item }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <span className="shrink-0 text-base leading-none">{icon}</span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {label}
                </div>
                <div className="truncate text-xs">
                  {item ? (
                    <span className="text-zinc-800 dark:text-zinc-200">
                      {item.name}
                    </span>
                  ) : (
                    <span className="italic text-zinc-400 dark:text-zinc-600">
                      없음
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TownPlaceCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white/40 dark:border-zinc-800 dark:bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
      >
        <span aria-hidden className="text-2xl leading-none">
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
        <span
          aria-hidden
          className={`shrink-0 text-zinc-400 transition-transform dark:text-zinc-500 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          {children}
        </div>
      )}
    </section>
  );
}

function TownPanel() {
  return (
    <div className="space-y-2">
      <TownPlaceCard
        icon="🏋️"
        title="훈련장"
        description="능력치를 단련할 수 있는 곳."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STAT_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
            >
              <span className="text-zinc-700 dark:text-zinc-300">
                {STAT_LABELS[k]} 단련
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                준비 중
              </span>
            </button>
          ))}
        </div>
      </TownPlaceCard>
    </div>
  );
}

function PlaceholderPanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-lg border border-dashed border-zinc-300 bg-white/40 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
      <div className="text-base font-medium text-zinc-700 dark:text-zinc-300">
        {title}
      </div>
      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{message}</div>
    </section>
  );
}

export default function Home() {
  const [name, setName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<TabKey>("adventure");

  useEffect(() => {
    try {
      for (const key of LEGACY_NAME_KEYS) localStorage.removeItem(key);
      const stored = localStorage.getItem(NAME_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setName(stored);
    } catch {}
    setHydrated(true);
  }, []);

  const handleNameSubmit = (next: string) => {
    try {
      localStorage.setItem(NAME_STORAGE_KEY, next);
    } catch {}
    setName(next);
  };

  const character = { ...baseCharacter, name: name ?? DEFAULT_NAME };
  const showModal = hydrated && !name;

  return (
    <>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-6 dark:border-zinc-800">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="shrink-0 text-xl font-semibold tracking-wide">무슨무슨게임</h1>
            <span className="truncate text-base text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {character.name}
              </span>
              <span className="ml-2 text-zinc-500 dark:text-zinc-500">
                Lv.{character.level}
              </span>
            </span>
          </div>
          <ThemeToggle />
        </header>

        <TabBar active={tab} onChange={setTab} />

        <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6">
          {tab === "adventure" && (
            <>
              <CharacterMini character={character} />
              <PlaceholderPanel
                title="모험"
                message="새로운 모험이 곧 시작됩니다."
              />
            </>
          )}
          {tab === "town" && <TownPanel />}
          {tab === "character" && (
            <>
              <CharacterPanel character={character} />
              <StatsPanel stats={character.stats} />
            </>
          )}
        </main>
      </div>
      {showModal && <NameSetupModal onSubmit={handleNameSubmit} />}
    </>
  );
}
