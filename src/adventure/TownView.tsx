"use client";

import { useState } from "react";
import { UserCircle } from "@phosphor-icons/react";
import type { Region } from "./data/world";
import { getNpcsByRegion, type Npc, type NpcRole } from "./data/npcs";
import { NpcDialogue } from "./NpcDialogue";

const ROLE_LABEL: Record<NpcRole, string> = {
  elder: "촌장",
  vendor: "상인",
  innkeeper: "여관 주인",
  quest: "의뢰인",
  lore: "마을 사람",
  stranger: "방문자",
};

const ROLE_COLOR: Record<NpcRole, string> = {
  elder: "text-amber-700",
  vendor: "text-emerald-600",
  innkeeper: "text-rose-500",
  quest: "text-blue-500",
  lore: "text-violet-500",
  stranger: "text-zinc-500",
};

export function TownView({ region }: { region: Region }) {
  const npcs = getNpcsByRegion(region.id);
  const [openNpc, setOpenNpc] = useState<Npc | null>(null);

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-zinc-200 bg-white/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {region.name}
        </div>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          {region.description}
        </p>
      </section>

      {npcs.length === 0 ? (
        <section className="rounded-lg border border-dashed border-zinc-300 bg-white/40 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
          <UserCircle
            size={40}
            weight="duotone"
            className="mx-auto text-zinc-400 dark:text-zinc-500"
          />
          <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
            마을 사람이 보이지 않습니다
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            어디로 갔는지 안개만 자욱하다.
          </div>
        </section>
      ) : (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            만날 수 있는 사람
          </div>
          {npcs.map((npc) => (
            <button
              key={npc.id}
              type="button"
              onClick={() => setOpenNpc(npc)}
              className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white/40 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900/40"
            >
              <UserCircle
                size={28}
                weight="duotone"
                className={`shrink-0 ${ROLE_COLOR[npc.role]}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-zinc-900 dark:text-zinc-100">
                  {npc.name}
                  <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    {ROLE_LABEL[npc.role]}
                  </span>
                </span>
                <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {npc.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {openNpc && (
        <NpcDialogue npc={openNpc} onClose={() => setOpenNpc(null)} />
      )}
    </div>
  );
}
