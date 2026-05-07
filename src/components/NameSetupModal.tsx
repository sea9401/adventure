"use client";

import { useState } from "react";
import { GenderFemale, GenderMale } from "@phosphor-icons/react";

export type Gender = "male" | "female";

export function NameSetupModal({
  onSubmit,
}: {
  onSubmit: (data: { name: string; gender: Gender }) => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && gender !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || gender === null) return;
    onSubmit({ name: trimmed, gender });
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
          모험가를 만들어보세요
        </h2>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          이름과 외형을 골라 새로운 모험을 시작합니다.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 입력"
              maxLength={16}
              autoFocus
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none transition-colors focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
            />
          </div>
          <div>
            <div className="mb-1.5 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              외형
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["male", "female"] as const).map((g) => {
                const selected = gender === g;
                const label = g === "male" ? "남자" : "여자";
                const Icon = g === "male" ? GenderMale : GenderFemale;
                const iconColor =
                  g === "male"
                    ? "text-sky-500 dark:text-sky-400"
                    : "text-pink-500 dark:text-pink-400";
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-1 rounded-md border px-3 py-3 text-sm transition-colors ${
                      selected
                        ? "border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-100"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-400"
                    }`}
                  >
                    <Icon size={28} weight="bold" className={iconColor} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-base font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            모험 시작
          </button>
        </form>
      </div>
    </div>
  );
}
