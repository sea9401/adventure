"use client";

import { MONSTERS } from "@/adventure/data/monsters";
import { MATERIALS } from "@/adventure/data/materials";
import { ITEMS } from "@/adventure/data/items";
import { getRecipeById } from "@/adventure/data/recipes";
import type { NpcRole } from "@/adventure/data/npcs";
import { getRevealStage, type MonsterRevealStage } from "@/adventure/log/thresholds";
import type { TitleCounterKey } from "@/adventure/data/titles";

export type TitleCounterValues = Partial<Record<TitleCounterKey, number>>;

export const ROLE_LABEL: Record<NpcRole, string> = {
  elder: "촌장",
  vendor: "상인",
  innkeeper: "여관 주인",
  quest: "의뢰인",
  lore: "마을 사람",
  stranger: "방문자",
  trainer: "교관",
};

// "오늘" / "어제" / "N일 전" / 한 달 넘으면 절대 날짜.
export function relativeTime(ts?: number): string {
  if (!ts) return "—";
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 1) return "오늘";
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

export function describeDrop(
  d: NonNullable<(typeof MONSTERS)[string]["drops"]>[number],
): string {
  if (d.kind === "material") {
    const name = MATERIALS[d.materialId]?.name ?? d.materialId;
    return d.amount && d.amount > 1 ? `${name} ×${d.amount}` : name;
  }
  if (d.kind === "gold") return `골드 +${d.amount}`;
  if (d.kind === "equip") return ITEMS[d.itemId]?.name ?? d.itemId;
  if (d.kind === "recipe") return getRecipeById(d.recipeId)?.name ?? d.recipeId;
  // recipe_one_of
  return `${d.recipeIds.length}종 중 1`;
}

export function MonsterAvatar({
  name,
  stage,
}: {
  name: string;
  stage: MonsterRevealStage;
}) {
  const image = MONSTERS[name]?.image;
  const silhouette = stage === 1;
  if (!image) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-base text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
        ?
      </div>
    );
  }
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={silhouette ? "아직 발견되지 않은 몬스터" : name}
        className={`h-full w-full object-cover transition-all ${
          silhouette ? "opacity-30 brightness-0" : ""
        }`}
      />
    </div>
  );
}

export function MonsterAvatarMini({
  name,
  encountered,
}: {
  name: string;
  encountered: boolean;
}) {
  const image = MONSTERS[name]?.image;
  if (!image) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-zinc-100 text-[10px] text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
        ?
      </span>
    );
  }
  return (
    <span className="inline-block h-5 w-5 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={encountered ? name : ""}
        className={`h-full w-full object-cover ${encountered ? "" : "opacity-30 brightness-0"}`}
      />
    </span>
  );
}

export function StatRow({
  label,
  value,
  unlocked,
}: {
  label: string;
  value: number;
  unlocked: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span
        className={`tabular-nums ${
          unlocked
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-300 dark:text-zinc-700"
        }`}
      >
        {unlocked ? value : "?"}
      </span>
    </div>
  );
}

export { getRevealStage };
export type { MonsterRevealStage };
