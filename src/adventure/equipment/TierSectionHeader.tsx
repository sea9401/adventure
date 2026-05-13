// 인벤·도감·대장간 공용 — tier 그룹 헤더. "라벨 · 힌트 (n개)".
import type { EquipTierMeta } from "./tier";

export function TierSectionHeader({
  meta,
  count,
}: {
  meta: EquipTierMeta;
  count: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-zinc-300 pb-1 pt-1 dark:border-zinc-700">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
          T{meta.tier} {meta.label}
        </span>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {meta.hint}
        </span>
      </div>
      <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">
        {count}개
      </span>
    </div>
  );
}
