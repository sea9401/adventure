// 인벤·도감·대장간 공용 — tier 그룹 헤더. "T1 라벨 · 힌트 (n개)".
// 접기/펴기 토글 — 기본 접힘. 검색 중에는 강제 펼침(자동), 평소엔 클릭으로 토글.
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import type { EquipTierMeta } from "./tier";

export function TierSectionHeader({
  meta,
  count,
  expanded,
  onToggle,
}: {
  meta: EquipTierMeta;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex w-full items-baseline justify-between gap-2 border-b border-dashed border-zinc-300 pb-1 pt-1 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900/50"
    >
      <div className="flex items-baseline gap-1.5">
        {expanded ? (
          <CaretDown
            size={11}
            weight="bold"
            className="self-center text-zinc-500 dark:text-zinc-400"
            aria-hidden
          />
        ) : (
          <CaretRight
            size={11}
            weight="bold"
            className="self-center text-zinc-500 dark:text-zinc-400"
            aria-hidden
          />
        )}
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
    </button>
  );
}
