// 인벤·도감·대장간 공용 검색 인풋 — 장비/레시피 이름 부분 일치 필터.
// 컨트롤드 컴포넌트 — value/onChange 상위에서 관리.
"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";

export function EquipmentSearchInput({
  value,
  onChange,
  placeholder = "이름으로 검색",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <MagnifyingGlass
        size={14}
        weight="bold"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-8 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="검색어 지우기"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          <X size={12} weight="bold" />
        </button>
      )}
    </div>
  );
}
