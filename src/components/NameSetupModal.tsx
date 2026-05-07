"use client";

import { useState } from "react";

export function NameSetupModal({
  onSubmit,
}: {
  onSubmit: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-setup-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2 id="name-setup-title" className="text-xl font-semibold">
          모험가의 이름은?
        </h2>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          새로운 모험을 시작합니다. 이름을 정해 주세요.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="이름 입력"
            maxLength={16}
            autoFocus
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none transition-colors focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={!trimmed}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-base font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            모험 시작
          </button>
        </form>
      </div>
    </div>
  );
}
