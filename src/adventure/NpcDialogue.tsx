"use client";

import { UserCircle, X } from "@phosphor-icons/react";
import type { Npc, NpcRole } from "./data/npcs";

const ROLE_COLOR: Record<NpcRole, string> = {
  elder: "text-amber-700",
  vendor: "text-emerald-600",
  innkeeper: "text-rose-500",
  quest: "text-blue-500",
  lore: "text-violet-500",
  stranger: "text-zinc-500",
};

export function NpcDialogue({
  npc,
  onClose,
}: {
  npc: Npc;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="npc-dialogue-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <UserCircle
              size={48}
              weight="duotone"
              className={`shrink-0 ${ROLE_COLOR[npc.role]}`}
            />
            <div className="min-w-0">
              <div
                id="npc-dialogue-title"
                className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {npc.name}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {npc.description}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {npc.greeting}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          떠나기
        </button>
      </div>
    </div>
  );
}
