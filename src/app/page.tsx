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

const baseCharacter = {
  className: "무직",
  level: 1,
  hp: 50,
  maxHp: 50,
  mp: 30,
  maxMp: 30,
  gold: 0,
  equipped: {
    weapon: {
      name: "나뭇가지",
      stats: [{ label: "공격력", value: "+1" }],
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

export default function Home() {
  const [name, setName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

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

        <main className="mx-auto w-full max-w-2xl flex-1 p-4 sm:p-6">
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
        </main>
      </div>
      {showModal && <NameSetupModal onSubmit={handleNameSubmit} />}
    </>
  );
}
