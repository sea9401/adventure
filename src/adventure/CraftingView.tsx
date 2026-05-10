"use client";

import { useState } from "react";
import { Hammer } from "@phosphor-icons/react";
import { ITEMS, type ItemId } from "./data/items";
import { MATERIALS, type MaterialId } from "./data/materials";
import { POTIONS, type PotionId } from "./data/potions";
import { RECIPES, type Recipe, type RecipeIngredient } from "./data/recipes";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";

type CraftCategory = "weapon" | "armor" | "accessory" | "potion";

const CATEGORY_TABS: ReadonlyArray<{ key: CraftCategory; label: string }> = [
  { key: "weapon", label: "무기" },
  { key: "armor", label: "방어구" },
  { key: "accessory", label: "장신구" },
  { key: "potion", label: "포션" },
];

function recipeCategory(r: Recipe): CraftCategory {
  if (r.result.kind === "potion") return "potion";
  return r.result.slot;
}

function ingredientCount(
  ing: RecipeIngredient,
  materialCounts: Partial<Record<MaterialId, number>>,
  equipmentCounts: Partial<Record<ItemId, number>>,
): { have: number; name: string } {
  if (ing.kind === "material") {
    return {
      have: materialCounts[ing.materialId] ?? 0,
      name: MATERIALS[ing.materialId].name,
    };
  }
  return {
    have: equipmentCounts[ing.itemId] ?? 0,
    name: ITEMS[ing.itemId].name,
  };
}

function ingredientKey(ing: RecipeIngredient): string {
  return ing.kind === "material" ? `m:${ing.materialId}` : `e:${ing.itemId}`;
}

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
  equipmentCounts,
  potionCounts,
  potionMax,
  onCraft,
}: {
  knownIds: string[];
  materialCounts: Partial<Record<MaterialId, number>>;
  equipmentCounts: Partial<Record<ItemId, number>>;
  potionCounts: Partial<Record<PotionId, number>>;
  potionMax: number;
  onCraft: (recipe: Recipe) => void;
}) {
  const knownRecipes = RECIPES.filter((r) => knownIds.includes(r.id));
  const [tab, setTab] = useState<CraftCategory>("weapon");
  const filtered = knownRecipes.filter((r) => recipeCategory(r) === tab);
  const pager = usePagination(filtered, 10);
  const tabLabel = CATEGORY_TABS.find((t) => t.key === tab)?.label ?? "";

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
    <div className="space-y-3">
      <TabBar
        tabs={CATEGORY_TABS}
        active={tab}
        onChange={setTab}
        ariaLabel="대장간 카테고리"
      />
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Hammer size={40} weight="duotone" />}
          title={`${tabLabel} 제작서가 없습니다`}
          message="제작서를 손에 넣으면 여기에 자동으로 등록됩니다."
        />
      ) : (
        <Card as="section" padding="md">
          <div className="space-y-2">
            {pager.pageItems.map((r) => {
              const { title, meta } = summarizeResult(r);
              const hasMaterials = r.ingredients.every(
                (ing) =>
                  ingredientCount(ing, materialCounts, equipmentCounts).have >=
                  ing.count,
              );
              // 포션 결과는 종류별 한도(potionMax)에 걸리면 제작 불가.
              // 한도까지 가득 차 있으면 재료만 소비되는 버그를 막기 위해 사전 차단.
              const potionFull =
                r.result.kind === "potion" &&
                (potionCounts[r.result.potionId] ?? 0) >= potionMax;
              const canCraft = hasMaterials && !potionFull;
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
                      <span className="text-zinc-500 dark:text-zinc-400">
                        재료:
                      </span>
                      {r.ingredients.map((ing) => {
                        const { have, name } = ingredientCount(
                          ing,
                          materialCounts,
                          equipmentCounts,
                        );
                        const enough = have >= ing.count;
                        return (
                          <span
                            key={ingredientKey(ing)}
                            className={
                              enough
                                ? "text-zinc-700 dark:text-zinc-300"
                                : "text-rose-600 dark:text-rose-400"
                            }
                          >
                            {name} {have}/{ing.count}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {potionFull && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      포션 보유 한도에 도달해 더 만들 수 없습니다.
                    </p>
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
            <Pagination
              page={pager.page}
              pageCount={pager.pageCount}
              setPage={pager.setPage}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
