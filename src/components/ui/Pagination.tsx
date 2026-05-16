"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";

// 목록 하단에 노출하는 페이지 네비게이션. pageCount 가 1 이면 자체 hidden — 호출부에서
// 분기 안 해도 됨. usePagination 훅과 짝지어 사용.
export function Pagination({
  page,
  pageCount,
  setPage,
  className,
}: {
  page: number;
  pageCount: number;
  setPage: (n: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const hasPrev = page > 0;
  const hasNext = page < pageCount - 1;
  return (
    <div
      className={`flex items-center justify-center gap-2 pt-2 text-xs ${className ?? ""}`}
      role="navigation"
      aria-label="페이지 네비게이션"
    >
      <button
        type="button"
        onClick={() => setPage(page - 1)}
        disabled={!hasPrev}
        aria-label="이전 페이지"
        className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <CaretLeft size={16} weight="bold" />
      </button>
      <span className="min-w-[3.5rem] text-center font-medium tabular-nums text-zinc-600 dark:text-zinc-400">
        {page + 1} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => setPage(page + 1)}
        disabled={!hasNext}
        aria-label="다음 페이지"
        className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <CaretRight size={16} weight="bold" />
      </button>
    </div>
  );
}
