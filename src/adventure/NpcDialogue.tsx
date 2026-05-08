"use client";

import { X } from "@phosphor-icons/react";
import type { Npc } from "./data/npcs";
import { NpcAvatar } from "./NpcAvatar";

export type NpcDialogueAction = {
  label: string;
  onClick: () => void;
};

export function NpcDialogue({
  npc,
  onClose,
  text,
  primaryAction,
  closeLabel = "떠나기",
}: {
  npc: Npc;
  onClose: () => void;
  text?: string;
  primaryAction?: NpcDialogueAction;
  closeLabel?: string;
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
        className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <NpcAvatar npc={npc} size={112} />
            <div className="min-w-0">
              <div
                id="npc-dialogue-title"
                className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {npc.name}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
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

        <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {text ?? npc.greeting}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              {primaryAction.label}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
