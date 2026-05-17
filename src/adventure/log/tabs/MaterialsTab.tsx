"use client";

import { useMemo, useState } from "react";
import { Package } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { MATERIALS, type Material, type MaterialId } from "@/adventure/data/materials";
import { MONSTERS } from "@/adventure/data/monsters";
import { isBossMonster } from "@/adventure/data/bosses";
import type { AdventureLog } from "@/adventure/log/storage";
import { getRevealStage } from "@/adventure/log/thresholds";
import { EquipmentSearchInput } from "@/adventure/equipment/EquipmentSearchInput";
import { MonsterAvatarMini } from "./shared";

type MonsterSource = {
  name: string;
  chance: number;
  amount: number;
  isBoss: boolean;
};

// 모듈 로드 시점 1회만 계산: 재료 → 그 재료를 드랍하는 몬스터 목록.
// 드랍률 내림차순 — 가장 잘 떨어뜨리는 몬스터가 위.
const MATERIAL_SOURCES: Partial<Record<MaterialId, MonsterSource[]>> = (() => {
  const map: Partial<Record<MaterialId, MonsterSource[]>> = {};
  for (const [name, mon] of Object.entries(MONSTERS)) {
    if (!mon.drops) continue;
    for (const d of mon.drops) {
      if (d.kind !== "material") continue;
      const list = (map[d.materialId] ??= []);
      list.push({
        name,
        chance: d.chance,
        amount: d.amount ?? 1,
        isBoss: isBossMonster(name),
      });
    }
  }
  for (const id of Object.keys(map) as MaterialId[]) {
    map[id]!.sort((a, b) => b.chance - a.chance);
  }
  return map;
})();

// PlacesTab 의 드랍 % 노출 규칙과 동일 — stage 4 (1000+ 처치 / 보스 10+) 부터 정확 확률 공개,
// 그 전엔 "?" 로 가려 둔다. 미발견(encountered=false) 몬스터는 실루엣 + "???" — PlacesTab 일관.
function formatChance(chance: number): string {
  return `${(chance * 100).toFixed(chance < 0.01 ? 2 : 1)}%`;
}

export function MaterialsTab({ log }: { log: AdventureLog }) {
  const [query, setQuery] = useState("");

  const entries = useMemo(() => {
    const all = (Object.keys(MATERIALS) as MaterialId[])
      .map((id) => ({
        material: MATERIALS[id] as Material,
        sources: MATERIAL_SOURCES[id] ?? [],
      }))
      .filter((e) => e.sources.length > 0);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => e.material.name.toLowerCase().includes(q));
  }, [query]);

  const pager = usePagination(entries, 10);
  const searching = query.trim().length > 0;
  const hasAnyMaterial = (Object.keys(MATERIAL_SOURCES) as MaterialId[]).length > 0;

  if (!hasAnyMaterial) {
    return (
      <EmptyState
        icon={<Package size={40} weight="duotone" />}
        title="아직 기록된 재료가 없습니다"
        message="몬스터를 잡고 재료를 모으면 여기에서 출처를 확인할 수 있습니다."
      />
    );
  }

  return (
    <div className="space-y-2">
      <EquipmentSearchInput
        value={query}
        onChange={setQuery}
        placeholder="재료 이름으로 검색"
      />
      {entries.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          “{query}” — 일치하는 재료가 없습니다.
        </p>
      ) : (
        <>
          {pager.pageItems.map(({ material, sources }) => (
            <MaterialCard
              key={material.id}
              material={material}
              sources={sources}
              log={log}
            />
          ))}
          {!searching && (
            <Pagination
              page={pager.page}
              pageCount={pager.pageCount}
              setPage={pager.setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

function MaterialCard({
  material,
  sources,
  log,
}: {
  material: Material;
  sources: MonsterSource[];
  log: AdventureLog;
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          📦 {material.name}
        </span>
        <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
          {sources.length}종 드랍
        </span>
      </div>
      {material.description && (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {material.description}
        </p>
      )}
      <ul className="mt-2 space-y-0.5 border-t border-dashed border-zinc-200 pt-1.5 text-[11px] dark:border-zinc-700">
        {sources.map((s) => {
          const entry = log.monsters[s.name];
          const encountered = !!entry?.encountered;
          const stage = getRevealStage(entry?.kills ?? 0, s.isBoss);
          const showExactChance = stage >= 4;
          return (
            <li
              key={s.name}
              className="flex items-center justify-between gap-2 py-0.5"
            >
              <span className="flex items-center gap-1.5">
                <MonsterAvatarMini name={s.name} encountered={encountered} />
                <span
                  className={
                    encountered
                      ? "text-zinc-800 dark:text-zinc-200"
                      : "text-zinc-400 dark:text-zinc-600"
                  }
                >
                  {encountered ? s.name : "???"}
                </span>
                {s.amount > 1 && encountered && (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    ×{s.amount}
                  </span>
                )}
              </span>
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                {showExactChance ? formatChance(s.chance) : "?"}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
