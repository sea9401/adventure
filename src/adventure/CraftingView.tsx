"use client";

import { useMemo, useState } from "react";
import { Hammer } from "@phosphor-icons/react";
import { ITEMS, type ItemId } from "./data/items";
import { MATERIALS, type MaterialId } from "./data/materials";
import { POTIONS, type PotionId } from "./data/potions";
import { RECIPES, type Recipe, type RecipeIngredient } from "./data/recipes";
import { craftVarianceSummary } from "./data/craftQuality";
import { CRAFT_BATCH_MAX } from "./crafting/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import {
  EQUIP_TIER_FALLBACK,
  getItemTier,
  groupByTier,
} from "@/adventure/equipment/tier";
import { EquipmentSearchInput } from "@/adventure/equipment/EquipmentSearchInput";
import { TierSectionHeader } from "@/adventure/equipment/TierSectionHeader";

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
  // 제작 품질 변동 안내 — "공격력 +1~+5" 식. 없으면 null.
  variance: string | null;
} {
  if (r.result.kind === "equipment") {
    const item = ITEMS[r.result.itemId];
    return {
      title: r.name,
      meta: item.stats.map((s) => `${s.label} ${s.value}`).join(" · "),
      variance: craftVarianceSummary(item, r),
    };
  }
  const potion = POTIONS[r.result.potionId];
  const qty = r.result.quantity;
  return {
    title: r.name,
    meta: qty > 1 ? `${potion.name} ×${qty}` : potion.name,
    variance: null,
  };
}

// 한 번 호출로 만들 수 있는 최대 횟수 N — 재료 충분량 ÷ 회당 소비량의 최솟값, 포션 결과면 보유 한도도 함께,
// 절대 상한은 CRAFT_BATCH_MAX. 0 이면 제작 불가.
function maxCraftable(
  r: Recipe,
  materialCounts: Partial<Record<MaterialId, number>>,
  equipmentCounts: Partial<Record<ItemId, number>>,
  potionCounts: Partial<Record<PotionId, number>>,
  potionMax: number,
): number {
  let cap = CRAFT_BATCH_MAX;
  for (const ing of r.ingredients) {
    const have = ingredientCount(ing, materialCounts, equipmentCounts).have;
    cap = Math.min(cap, Math.floor(have / ing.count));
    if (cap <= 0) return 0;
  }
  if (r.result.kind === "potion") {
    const headroom =
      potionMax - (potionCounts[r.result.potionId] ?? 0);
    cap = Math.min(cap, Math.floor(headroom / r.result.quantity));
  }
  return Math.max(0, cap);
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
  onCraft: (recipe: Recipe, quantity?: number) => void;
}) {
  const knownRecipes = RECIPES.filter((r) => knownIds.includes(r.id));
  const [tab, setTab] = useState<CraftCategory>("weapon");
  const [query, setQuery] = useState("");
  // 카테고리 + 이름 부분 일치 필터.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return knownRecipes.filter((r) => {
      if (recipeCategory(r) !== tab) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q);
    });
  }, [knownRecipes, tab, query]);
  // 장비 카테고리는 진행 티어로 그룹, 포션은 평면 — getItemTier 가 비장비 결과엔 fallback 반환.
  const grouped = useMemo(() => {
    if (tab === "potion") return null;
    return groupByTier(filtered, (r) =>
      r.result.kind === "equipment"
        ? getItemTier(r.result.itemId)
        : EQUIP_TIER_FALLBACK,
    );
  }, [filtered, tab]);
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
        onChange={(k) => {
          setTab(k);
          setQuery("");
        }}
        ariaLabel="대장간 카테고리"
      />
      <EquipmentSearchInput value={query} onChange={setQuery} />
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Hammer size={40} weight="duotone" />}
          title={
            query
              ? `“${query}” — 일치하는 ${tabLabel} 제작서가 없습니다`
              : `${tabLabel} 제작서가 없습니다`
          }
          message={
            query
              ? "다른 키워드로 검색해 보세요."
              : "제작서를 손에 넣으면 여기에 자동으로 등록됩니다."
          }
        />
      ) : grouped ? (
        // 장비 — 티어별 카드 묶음.
        grouped.map(({ tier, meta, entries }) => (
          <Card key={tier} as="section" padding="md">
            <div className="space-y-2">
              <TierSectionHeader meta={meta} count={entries.length} />
              {entries.map((r) => (
                <RecipeRow
                  key={r.id}
                  recipe={r}
                  materialCounts={materialCounts}
                  equipmentCounts={equipmentCounts}
                  potionCounts={potionCounts}
                  potionMax={potionMax}
                  onCraft={onCraft}
                />
              ))}
            </div>
          </Card>
        ))
      ) : (
        // 포션 — 평면 리스트.
        <Card as="section" padding="md">
          <div className="space-y-2">
            {filtered.map((r) => (
              <RecipeRow
                key={r.id}
                recipe={r}
                materialCounts={materialCounts}
                equipmentCounts={equipmentCounts}
                potionCounts={potionCounts}
                potionMax={potionMax}
                onCraft={onCraft}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// 한 레시피 카드 — 수량 입력 + "최대" 버튼 + "제작 ×N" 버튼.
// 수량 state 는 행마다 독립이라 페이지/탭이 바뀌어도 보이는 행은 1 로 새로 시작한다.
function RecipeRow({
  recipe,
  materialCounts,
  equipmentCounts,
  potionCounts,
  potionMax,
  onCraft,
}: {
  recipe: Recipe;
  materialCounts: Partial<Record<MaterialId, number>>;
  equipmentCounts: Partial<Record<ItemId, number>>;
  potionCounts: Partial<Record<PotionId, number>>;
  potionMax: number;
  onCraft: (recipe: Recipe, quantity?: number) => void;
}) {
  const { title, meta, variance } = summarizeResult(recipe);
  const max = useMemo(
    () =>
      maxCraftable(
        recipe,
        materialCounts,
        equipmentCounts,
        potionCounts,
        potionMax,
      ),
    [recipe, materialCounts, equipmentCounts, potionCounts, potionMax],
  );

  // 수량 입력 상태 — 사용자 의도를 그대로 들고 있다가, "제작" 누를 때 1..max 로 clamp.
  // max 가 0 이 되거나 줄어들면 버튼은 disabled 로, 입력 자체는 비우지 않는다(타이핑 중 끊기지 않게).
  const [qty, setQty] = useState(1);
  const effectiveQty = Math.min(Math.max(1, qty), Math.max(1, max));
  const canCraft = max > 0;
  // 포션 결과 한도 자체에 닿아서 max=0 인 케이스는 별도 안내(과거 동작 유지).
  const potionFull =
    recipe.result.kind === "potion" &&
    (potionCounts[recipe.result.potionId] ?? 0) >= potionMax;

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </span>
        <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
          {meta}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        {recipe.description}
      </p>
      {variance && (
        <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
          품질에 따라 변동 — {variance}
        </p>
      )}
      {recipe.ingredients.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">재료:</span>
          {recipe.ingredients.map((ing) => {
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          수량
          <input
            type="number"
            min={1}
            max={Math.max(1, max)}
            step={1}
            inputMode="numeric"
            value={qty}
            disabled={!canCraft}
            onChange={(e) => {
              // 빈 문자열 → 1, NaN/소수 → 정수화. 상한은 제작 시점에 clamp 하므로 여기선 약하게만.
              const next = Number.parseInt(e.target.value, 10);
              if (Number.isNaN(next)) setQty(1);
              else setQty(Math.max(1, Math.min(CRAFT_BATCH_MAX, next)));
            }}
            className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        <button
          type="button"
          onClick={() => setQty(max)}
          disabled={!canCraft}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          최대 ({max})
        </button>
        <button
          type="button"
          onClick={() => onCraft(recipe, effectiveQty)}
          disabled={!canCraft}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Hammer size={16} weight="duotone" className="text-amber-600" />
          제작{effectiveQty > 1 ? ` ×${effectiveQty}` : ""}
        </button>
      </div>
    </div>
  );
}
