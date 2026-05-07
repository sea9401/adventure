"use client";

import { Hammer } from "@phosphor-icons/react";
import { ITEMS } from "./data/items";
import { MATERIALS, type MaterialId } from "./data/materials";
import { POTIONS } from "./data/potions";
import { RECIPES, type Recipe } from "./data/recipes";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";

function summarizeResult(r: Recipe): {
  title: string;
  meta: string;
} {
  if (r.result.kind === "equipment") {
    const item = ITEMS[r.result.itemId];
    return {
      title: r.name,
      meta: item.stats.map((s) => `${s.label} ${s.value}`).join(" · "),
    };
  }
  const potion = POTIONS[r.result.potionId];
  const qty = r.result.quantity;
  return {
    title: r.name,
    meta: qty > 1 ? `${potion.name} ×${qty}` : potion.name,
  };
}

export function CraftingView({
  knownIds,
  materialCounts,
  onCraft,
}: {
  knownIds: string[];
  materialCounts: Partial<Record<MaterialId, number>>;
  onCraft: (recipe: Recipe) => void;
}) {
  const knownRecipes = RECIPES.filter((r) => knownIds.includes(r.id));

  if (knownRecipes.length === 0) {
    return (
      <EmptyState
        icon={<Hammer size={40} weight="duotone" />}
        title="아직 등록된 제작서가 없습니다"
        message="제작서를 손에 넣으면 여기에 자동으로 등록됩니다."
      />
    );
  }

  return (
    <Card as="section" padding="md">
      <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        등록된 제작서
      </div>
      <div className="space-y-2">
        {knownRecipes.map((r) => {
          const { title, meta } = summarizeResult(r);
          const canCraft = r.ingredients.every(
            (ing) => (materialCounts[ing.materialId] ?? 0) >= ing.count,
          );
          return (
            <div
              key={r.id}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {title}
                </span>
                <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                  {meta}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {r.description}
              </p>
              {r.ingredients.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">재료:</span>
                  {r.ingredients.map((ing) => {
                    const have = materialCounts[ing.materialId] ?? 0;
                    const enough = have >= ing.count;
                    return (
                      <span
                        key={ing.materialId}
                        className={
                          enough
                            ? "text-zinc-700 dark:text-zinc-300"
                            : "text-rose-600 dark:text-rose-400"
                        }
                      >
                        {MATERIALS[ing.materialId].name} {have}/{ing.count}
                      </span>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => onCraft(r)}
                disabled={!canCraft}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
    </Card>
  );
}
