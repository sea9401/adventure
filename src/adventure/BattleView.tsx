import type { Region } from "./data/world";
import { EnemyEncounterSection } from "./EnemyEncounterSection";

export function BattleView({ region }: { region: Region }) {
  const hasEnemies = region.enemies.length > 0;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-200 bg-white/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          현재 위치
        </div>
        <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {region.name}
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {region.description}
        </p>
      </div>

      {hasEnemies ? (
        <EnemyEncounterSection region={region} />
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white/40 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
          이곳에는 전투할 적이 없습니다.
        </div>
      )}
    </div>
  );
}
