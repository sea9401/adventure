"use client";

import { useState } from "react";
import { Diamond } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import {
  ITEMS,
  findItemId,
  type EquipSlot,
  type ItemId,
} from "@/adventure/data/items";
import { getRecipeById } from "@/adventure/data/recipes";
import type { EquippedSlots } from "@/adventure/character/types";

// 모험의 서 → 아이템 탭. 보유 장비를 슬롯별 sub-tab 으로, 학습한 제작법을 마지막 sub-tab 으로.
// 인벤토리 액션 패널이 아니라 도감 — 장착 버튼 등은 없고 정보만.
type ItemSubTab = "weapon" | "armor" | "accessory" | "recipe";

const ITEM_SUB_TABS: { key: ItemSubTab; label: string }[] = [
  { key: "weapon", label: "무기" },
  { key: "armor", label: "방어구" },
  { key: "accessory", label: "장신구" },
  { key: "recipe", label: "제작법" },
];

const SLOT_EMOJI: Record<EquipSlot, string> = {
  weapon: "⚔️",
  armor: "🛡️",
  accessory: "💍",
};

export function ItemsTab({
  knownRecipes,
  shareableRecipes,
  ownedEquipment,
  equippedSlots,
}: {
  knownRecipes: string[];
  shareableRecipes: string[];
  ownedEquipment: Partial<Record<ItemId, number>>;
  equippedSlots: EquippedSlots | undefined;
}) {
  const [sub, setSub] = useState<ItemSubTab>("weapon");

  return (
    <div className="space-y-3">
      <TabBar
        tabs={ITEM_SUB_TABS}
        active={sub}
        onChange={setSub}
        ariaLabel="아이템 종류"
        size="sm"
      />
      {sub === "recipe" ? (
        <RecipesSubTab
          knownRecipes={knownRecipes}
          shareableRecipes={shareableRecipes}
        />
      ) : (
        <EquipmentSubTab
          slot={sub}
          ownedEquipment={ownedEquipment}
          equippedSlots={equippedSlots}
        />
      )}
    </div>
  );
}

function EquipmentSubTab({
  slot,
  ownedEquipment,
  equippedSlots,
}: {
  slot: EquipSlot;
  ownedEquipment: Partial<Record<ItemId, number>>;
  equippedSlots: EquippedSlots | undefined;
}) {
  const items = (Object.keys(ITEMS) as ItemId[])
    .map((id) => ({ id, def: ITEMS[id], count: ownedEquipment[id] ?? 0 }))
    .filter((e) => e.count > 0 && e.def.slot === slot)
    .sort((a, b) => a.def.name.localeCompare(b.def.name));
  const pager = usePagination(items, 10);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Diamond size={40} weight="duotone" />}
        title="보유한 장비가 없습니다"
        message="제작·드랍·보상 등으로 얻으면 여기에 모입니다."
      />
    );
  }

  const equippedId = findItemId(equippedSlots?.[slot] ?? null);

  return (
    <div className="space-y-2">
      {pager.pageItems.map(({ id, def, count }) => {
        const isEquipped = equippedId === id;
        return (
          <Card key={id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {SLOT_EMOJI[def.slot]} {def.name}
                {count > 1 && (
                  <span className="ml-1 text-xs font-normal tabular-nums text-zinc-500 dark:text-zinc-400">
                    ×{count}
                  </span>
                )}
                {isEquipped && (
                  <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-normal text-emerald-700 dark:text-emerald-400">
                    장착중
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                {def.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}
              </span>
            </div>
            {def.description && (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {def.description}
              </p>
            )}
          </Card>
        );
      })}
      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        setPage={pager.setPage}
      />
    </div>
  );
}

// 보유 제작법 — 학습한 제작서를 카드로. 거래 토큰 보유/소진 상태 같이 표기.
// 토큰 = 1 (거래 가능) / 0 (이미 공유에 사용 — 다시 습득해야 충전).
// 거래/우편 출처 학습은 토큰을 부여하지 않으므로 거래 횟수에 자연 상한이 생긴다.
function RecipesSubTab({
  knownRecipes,
  shareableRecipes,
}: {
  knownRecipes: string[];
  shareableRecipes: string[];
}) {
  const recipes = knownRecipes
    .map((id) => ({ id, def: getRecipeById(id) }))
    .filter((r): r is { id: string; def: NonNullable<typeof r.def> } => !!r.def)
    .sort((a, b) => a.def.name.localeCompare(b.def.name));
  const pager = usePagination(recipes, 10);

  if (recipes.length === 0) {
    return (
      <EmptyState
        icon={<Diamond size={40} weight="duotone" />}
        title="아직 학습한 제작서가 없습니다"
        message="NPC 보상이나 몬스터 드랍으로 제작서를 얻으면 여기에 표시됩니다."
      />
    );
  }

  return (
    <div className="space-y-2">
      {pager.pageItems.map(({ id, def }) => {
        const canShare = shareableRecipes.includes(id);
        return (
          <Card key={id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                📜 {def.name}
              </span>
              <span
                className={
                  canShare
                    ? "shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-normal text-emerald-700 dark:text-emerald-400"
                    : "shrink-0 rounded-full bg-zinc-500/10 px-2 py-0.5 text-[11px] font-normal text-zinc-500 dark:text-zinc-400"
                }
                title={
                  canShare
                    ? "거래소 등록 또는 우편 첨부 가능"
                    : "이미 공유에 사용 — 다시 습득하면 충전됩니다"
                }
              >
                거래 {canShare ? 1 : 0}/1
              </span>
            </div>
            {def.description ? (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {def.description}
              </p>
            ) : null}
          </Card>
        );
      })}
      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        setPage={pager.setPage}
      />
    </div>
  );
}
