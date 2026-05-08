"use client";

import { useEffect, useState } from "react";
import { loadBundle, writeBundleKey } from "../storage-bundle";
import { useAdmin } from "../AdminContext";
import { Button, Checkbox, Select } from "../ui/Field";
import {
  WORLD_MAP,
  START_REGION_ID,
  type RegionId,
} from "@/adventure/data/world";
import {
  evaluateEdgeRequirement,
} from "@/adventure/data/edge-requirement";
import { initialMapProgress, type MapProgress } from "@/lib/map-progress";
import { emptyAdventureLog } from "@/adventure/log/storage";

export function MapTab() {
  const { readOnly, bump, bumpVersion, showToast } = useAdmin();
  const [progress, setProgress] = useState<MapProgress>(initialMapProgress);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(loadBundle().data.map ?? initialMapProgress);
  }, [bumpVersion]);

  const persist = (next: MapProgress) => {
    setProgress(next);
    writeBundleKey("map", next);
    bump();
    showToast("저장됨.");
  };

  const toggleVisited = (id: RegionId, on: boolean) => {
    const set = new Set(progress.visitedRegionIds);
    if (on) set.add(id);
    else set.delete(id);
    persist({ ...progress, visitedRegionIds: Array.from(set) });
  };

  const log = loadBundle().data.log ?? emptyAdventureLog();

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">현재 위치</h2>
        <div className="mt-2 max-w-sm">
          <Select<RegionId>
            value={progress.currentRegionId}
            disabled={readOnly}
            options={WORLD_MAP.regions.map((r) => ({
              value: r.id,
              label: `${r.name} (${r.id})`,
            }))}
            onChange={(currentRegionId) => persist({ ...progress, currentRegionId })}
          />
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">방문한 지역</h2>
          <div className="flex gap-2">
            <Button
              disabled={readOnly}
              onClick={() =>
                persist({
                  ...progress,
                  visitedRegionIds: WORLD_MAP.regions.map((r) => r.id),
                })
              }
            >
              모두 방문
            </Button>
            <Button
              disabled={readOnly}
              onClick={() => persist(initialMapProgress)}
            >
              village 만 남기기
            </Button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 md:grid-cols-3">
          {WORLD_MAP.regions.map((r) => (
            <Checkbox
              key={r.id}
              checked={progress.visitedRegionIds.includes(r.id)}
              disabled={readOnly}
              onChange={(v) => toggleVisited(r.id, v)}
              label={`${r.name} (${r.id})`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          시작 지역: <code>{START_REGION_ID}</code>
        </p>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">엣지 조건 디버그</h2>
        <p className="mt-1 text-xs text-zinc-500">
          현재 도감 기준으로 각 엣지 요건이 충족됐는지 표시 (방향성 있음).
        </p>
        <div className="mt-2 overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {["from", "to", "조건", "충족", "진행도"].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-1 text-left text-xs font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORLD_MAP.edges.map((e) => {
                const status = evaluateEdgeRequirement(e.requires, log);
                return (
                  <tr
                    key={`${e.from}-${e.to}`}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-2 py-1">{e.from}</td>
                    <td className="px-2 py-1">{e.to}</td>
                    <td className="px-2 py-1 font-mono text-xs">
                      {e.requires?.bestiaryOf
                        ? `bestiaryOf:${e.requires.bestiaryOf}`
                        : "—"}
                    </td>
                    <td className="px-2 py-1">{status.met ? "✓" : "—"}</td>
                    <td className="px-2 py-1">
                      {status.progress
                        ? `${status.progress.label} ${status.progress.current}/${status.progress.total}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
