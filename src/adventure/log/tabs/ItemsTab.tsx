"use client";

import { useMemo, useState } from "react";
import { Diamond } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { TabBar } from "@/components/ui/TabBar";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import {
  ITEMS,
  rarityTextClass,
  type EquipItem,
  type EquipSlot,
  type ItemId,
} from "@/adventure/data/items";
import { getRecipeById } from "@/adventure/data/recipes";
import { dropQualityTextClass } from "@/adventure/data/dropQuality";
import { craftTierTextClass } from "@/adventure/data/craftQuality";
import type { DiscoveredEquipmentEntry } from "@/adventure/log/storage";
import {
  parseVariantKey,
  resolveVariant,
  variantDisplayName,
  variantGradeLabel,
} from "@/adventure/log/discoveredEquipment";

// 모험의 서 → 아이템 탭. 한 번이라도 보유/장착한 적 있는 장비를 슬롯별 sub-tab 으로(폐기해도 유지),
// 학습한 제작법을 마지막 sub-tab 으로. 인벤토리 액션 패널이 아니라 도감 — 장착 버튼 등은 없고 정보만.
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
  discovered,
}: {
  knownRecipes: string[];
  shareableRecipes: string[];
  discovered: Record<string, DiscoveredEquipmentEntry>;
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
        <EquipmentSubTab slot={sub} discovered={discovered} />
      )}
    </div>
  );
}

type DiscoveredRow = {
  id: ItemId;
  variantKey: string;
  item: EquipItem;
  name: string;
  grade: string | null;
};

// 도감 등록분 → 표시 행 목록. (itemId × 변형) 한 줄. 슬롯 필터 + 이름순 정렬.
function buildRows(
  discovered: Record<string, DiscoveredEquipmentEntry>,
  slot: EquipSlot,
): DiscoveredRow[] {
  const rows: DiscoveredRow[] = [];
  for (const [idStr, entry] of Object.entries(discovered)) {
    const id = idStr as ItemId;
    const baseDef = ITEMS[id];
    if (!baseDef || baseDef.slot !== slot) continue;
    for (const key of entry.variants) {
      const item = resolveVariant(id, key);
      if (!item) continue;
      rows.push({
        id,
        variantKey: key,
        item,
        name: variantDisplayName(id, key),
        grade: variantGradeLabel(key),
      });
    }
  }
  rows.sort(
    (a, b) =>
      a.name.localeCompare(b.name) || a.variantKey.localeCompare(b.variantKey),
  );
  return rows;
}

function gradeTextClass(key: string): string {
  const p = parseVariantKey(key);
  if (!p) return "";
  if (p.kind === "crafted") return craftTierTextClass(p.tier);
  if (p.kind === "dropped") return dropQualityTextClass(p.quality);
  return "";
}

function EquipmentSubTab({
  slot,
  discovered,
}: {
  slot: EquipSlot;
  discovered: Record<string, DiscoveredEquipmentEntry>;
}) {
  const rows = useMemo(() => buildRows(discovered, slot), [discovered, slot]);
  const pager = usePagination(rows, 10);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Diamond size={40} weight="duotone" />}
        title="아직 발견한 장비가 없습니다"
        message="제작·드랍·보상 등으로 한 번이라도 얻으면 폐기해도 여기에 영구 기록됩니다."
      />
    );
  }

  return (
    <div className="space-y-2">
      {pager.pageItems.map((row) => (
        <Card key={`${row.id}@${row.variantKey}`}>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-sm font-semibold ${
                row.grade
                  ? gradeTextClass(row.variantKey)
                  : rarityTextClass(row.item)
              }`}
            >
              {SLOT_EMOJI[row.item.slot]} {row.name}
            </span>
            <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
              {row.item.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}
            </span>
          </div>
          {row.item.description && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {row.item.description}
            </p>
          )}
        </Card>
      ))}
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
