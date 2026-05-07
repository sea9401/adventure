import { ThemeToggle } from "@/components/ThemeToggle";

const character = {
  name: "모험가",
  className: "무직",
  level: 1,
  hp: 50,
  maxHp: 50,
  mp: 30,
  maxMp: 30,
  gold: 0,
  equipped: {
    weapon: null as string | null,
    armor: null as string | null,
    accessory: null as string | null,
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
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
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

function EquipCard({ title, item }: { title: string; item: string | null }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {title}
      </div>
      <div className="mt-1 text-sm">
        {item ? (
          <span className="text-zinc-900 dark:text-zinc-100">{item}</span>
        ) : (
          <span className="italic text-zinc-400 dark:text-zinc-600">없음</span>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-6 dark:border-zinc-800">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="shrink-0 text-lg font-semibold tracking-wide">무슨무슨게임</h1>
          <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">
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
          <div className="border-b border-zinc-200 px-4 py-2 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            캐릭터
          </div>
          <div className="space-y-2 p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-base font-semibold">{character.name}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {character.className}
              </span>
              <span className="text-sm text-zinc-400 dark:text-zinc-500">
                Lv.{character.level}
              </span>
            </div>

            <StatBar
              label="HP"
              value={character.hp}
              max={character.maxHp}
              color="bg-emerald-500"
            />
            <StatBar
              label="MP"
              value={character.mp}
              max={character.maxMp}
              color="bg-sky-500"
            />

            <div className="flex items-center justify-between text-xs">
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
  );
}
