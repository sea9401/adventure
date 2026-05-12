"use client";

import { useState } from "react";
import { CaretDown, CaretRight, Compass } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { MONSTERS } from "@/adventure/data/monsters";
import { WORLD_MAP } from "@/adventure/data/world";
import type { AdventureLog, MonsterLogEntry } from "@/adventure/log/storage";
import { MonsterAvatarMini, MonsterStatBlock, relativeTime } from "./shared";

// 사냥터별 회고 — 첫 발자국, 누적 처치, 몬스터별 디테일.
// 몬스터 도감은 별도 탭이 아니라 여기에 통합돼 있다: 각 지역의 몬스터 행을 펼치면
// 스탯/드랍 등 세부 정보가 보인다.
// 주의: log.monsters[name].kills 는 region 무관 누적이므로, 같은 몬스터가 여러 지역에
// 등장하면 양쪽 카드에 동일 수치가 보인다. 현재 데이터 모델 한계 (region 별 분리 추적은 별도 작업).
export function PlacesTab({ log }: { log: AdventureLog }) {
  const places = WORLD_MAP.regions.filter(
    (r) => !r.tags?.includes("town") && log.towns[r.id]?.visited,
  );

  // 어떤 지역의 enemies 목록에도 없는 조우 몬스터 (특수 보스·이벤트 등) → '기타' 카드로.
  const placedNames = new Set(WORLD_MAP.regions.flatMap((r) => r.enemies));
  const orphans = Object.entries(log.monsters).filter(
    ([name, e]) => e.encountered && !placedNames.has(name),
  );

  const pager = usePagination(places, 10);

  if (places.length === 0 && orphans.length === 0) {
    return (
      <EmptyState
        icon={<Compass size={40} weight="duotone" />}
        title="아직 기록된 장소가 없습니다"
        message="새로운 곳을 방문하면 안내문이 추가됩니다."
      />
    );
  }
  return (
    <div className="space-y-2">
      {pager.pageItems.map((r) => (
        <PlaceCard key={r.id} region={r} log={log} />
      ))}
      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        setPage={pager.setPage}
      />
      {pager.page === pager.pageCount - 1 && orphans.length > 0 && (
        <OrphanCard
          entries={orphans
            .slice()
            .sort((a, b) => (b[1].kills ?? 0) - (a[1].kills ?? 0))}
        />
      )}
    </div>
  );
}

function PlaceCard({
  region,
  log,
}: {
  region: (typeof WORLD_MAP.regions)[number];
  log: AdventureLog;
}) {
  const [open, setOpen] = useState(false);
  const town = log.towns[region.id];
  const enemyEntries = region.enemies.map((name) => ({
    name,
    entry: log.monsters[name],
  }));
  const totalEnemies = enemyEntries.length;
  const encountered = enemyEntries.filter((e) => e.entry?.encountered).length;
  const totalKills = enemyEntries.reduce(
    (a, e) => a + (e.entry?.kills ?? 0),
    0,
  );

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-mx-1 -my-0.5 flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
      >
        <span className="flex items-center gap-1.5">
          {open ? (
            <CaretDown size={14} className="text-zinc-400" />
          ) : (
            <CaretRight size={14} className="text-zinc-400" />
          )}
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {region.name}
          </span>
        </span>
        {region.recommendedLevel !== undefined && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            적정 Lv.{region.recommendedLevel}
          </span>
        )}
      </button>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        {region.description}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span>첫 발자국 {relativeTime(town?.firstVisitedAt)}</span>
        {totalEnemies > 0 && (
          <>
            <span>
              만난 종 {encountered} / {totalEnemies}
            </span>
            <span>누적 처치 {totalKills.toLocaleString()}</span>
          </>
        )}
      </div>
      {open && totalEnemies > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          {enemyEntries
            .slice()
            .sort((a, b) => (b.entry?.kills ?? 0) - (a.entry?.kills ?? 0))
            .map((e) => (
              <MonsterRow key={e.name} name={e.name} entry={e.entry} />
            ))}
        </ul>
      )}
    </Card>
  );
}

function OrphanCard({ entries }: { entries: [string, MonsterLogEntry][] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-mx-1 -my-0.5 flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
      >
        <span className="flex items-center gap-1.5">
          {open ? (
            <CaretDown size={14} className="text-zinc-400" />
          ) : (
            <CaretRight size={14} className="text-zinc-400" />
          )}
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            기타 / 미분류
          </span>
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {entries.length}종
        </span>
      </button>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        특정 사냥터에 속하지 않은 적 — 의뢰·이벤트 등에서 만난 기록.
      </p>
      {open && (
        <ul className="mt-2 space-y-0.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          {entries.map(([name, entry]) => (
            <MonsterRow key={name} name={name} entry={entry} />
          ))}
        </ul>
      )}
    </Card>
  );
}

// 몬스터 한 행 — 클릭하면 스탯/드랍 등 세부 정보를 펼친다 (조우한 몬스터만).
function MonsterRow({
  name,
  entry,
}: {
  name: string;
  entry?: MonsterLogEntry;
}) {
  const [open, setOpen] = useState(false);
  const encountered = !!entry?.encountered;
  const kills = entry?.kills ?? 0;
  const canExpand = encountered && !!MONSTERS[name];

  return (
    <li className="text-xs">
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => setOpen((v) => !v)}
        className="-mx-1 flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left enabled:hover:bg-zinc-50 disabled:cursor-default dark:enabled:hover:bg-zinc-800/40"
      >
        <span className="flex items-center gap-2">
          {canExpand ? (
            open ? (
              <CaretDown size={12} className="text-zinc-400" />
            ) : (
              <CaretRight size={12} className="text-zinc-400" />
            )
          ) : (
            <span className="inline-block w-3" />
          )}
          <MonsterAvatarMini name={name} encountered={encountered} />
          <span
            className={
              encountered
                ? "text-zinc-800 dark:text-zinc-200"
                : "text-zinc-400 dark:text-zinc-600"
            }
          >
            {encountered ? name : "???"}
          </span>
        </span>
        <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
          {kills ? (
            <>
              <span className="tabular-nums">{kills.toLocaleString()}회</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                · 마지막 {relativeTime(entry?.lastKilledAt)}
              </span>
            </>
          ) : encountered ? (
            <span className="text-[10px]">조우만</span>
          ) : (
            <span className="text-[10px]">미발견</span>
          )}
        </span>
      </button>
      {open && canExpand && (
        <div className="ml-7 mt-1 mb-1 rounded-md bg-zinc-50 px-2 py-1.5 dark:bg-zinc-800/40">
          <MonsterStatBlock name={name} kills={kills} />
        </div>
      )}
    </li>
  );
}
