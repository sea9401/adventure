"use client";

import { Sword } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { MONSTERS } from "@/adventure/data/monsters";
import type { AdventureLog } from "@/adventure/log/storage";
import {
  MonsterAvatar,
  StatRow,
  describeDrop,
  getRevealStage,
} from "./shared";

export function MonstersTab({ log }: { log: AdventureLog }) {
  const entries = Object.entries(log.monsters)
    .filter(([, e]) => e.encountered)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const pager = usePagination(entries, 10);
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Sword size={40} weight="duotone" />}
        title="아직 기록된 몬스터가 없습니다"
        message="전투에서 적을 처음 만나면 도감에 등록됩니다."
      />
    );
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {pager.pageItems.map(([name, entry]) => (
          <MonsterLogCard key={name} name={name} kills={entry.kills} />
        ))}
      </div>
      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        setPage={pager.setPage}
      />
    </div>
  );
}

function MonsterLogCard({ name, kills }: { name: string; kills: number }) {
  const monster = MONSTERS[name];
  const stage = getRevealStage(kills);

  return (
    <Card>
      <div className="flex items-center gap-3">
        <MonsterAvatar name={name} stage={stage} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              처치 {kills}
            </span>
          </div>
          {monster && (
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <StatRow label="HP" value={monster.hp} unlocked={stage >= 2} />
              <StatRow label="EXP" value={monster.exp} unlocked={stage >= 4} />
              <StatRow label="ATK" value={monster.atk} unlocked={stage >= 3} />
              <StatRow label="DEF" value={monster.def} unlocked={stage >= 3} />
              <StatRow label="SPD" value={monster.spd} unlocked={stage >= 3} />
            </div>
          )}
          {monster?.drops && monster.drops.length > 0 && stage >= 3 && (
            <div className="mt-2 border-t border-dashed border-zinc-200 pt-1 dark:border-zinc-700">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                드랍
              </div>
              <ul className="mt-0.5 space-y-0.5 text-[11px] text-zinc-700 dark:text-zinc-300">
                {monster.drops.map((d, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{describeDrop(d)}</span>
                    <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {stage >= 4
                        ? `${(d.chance * 100).toFixed(d.chance < 0.01 ? 2 : 1)}%`
                        : "?"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
