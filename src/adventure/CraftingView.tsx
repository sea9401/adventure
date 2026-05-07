"use client";

import { Hammer } from "@phosphor-icons/react";
import { ITEMS } from "./data/items";
import { RECIPES, type Recipe } from "./data/recipes";

export function CraftingView({
  knownIds,
  onCraft,
}: {
  knownIds: string[];
  onCraft: (recipe: Recipe) => void;
}) {
  const knownRecipes = RECIPES.filter((r) => knownIds.includes(r.id));

  if (knownRecipes.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white/90 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/90">
        <Hammer
          size={40}
          weight="duotone"
          className="mx-auto text-zinc-400 dark:text-zinc-500"
        />
        <div className="mt-3 text-base font-medium text-zinc-700 dark:text-zinc-300">
          아직 등록된 제작서가 없습니다
        </div>
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          제작서를 손에 넣으면 여기에 자동으로 등록됩니다.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        등록된 제작서
      </div>
      <div className="space-y-2">
        {knownRecipes.map((r) => {
          const item = ITEMS[r.result];
          return (
            <div
              key={r.id}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {r.name}
                </span>
                <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                  {item.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {r.description}
              </p>
              <button
                type="button"
                onClick={() => onCraft(r)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Hammer
                  size={16}
                  weight="duotone"
                  className="text-amber-600"
                />
                제작
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
