"use client";

import { useState } from "react";
import { User } from "@phosphor-icons/react";

// 캐릭터 아바타 id — 외형 6종 (남자 1~3 / 여자 1~3).
// 이전 버전의 "male"/"female" 도 마이그레이션 시점에 male1/female1 로 흡수.
export const AVATARS = [
  "male1",
  "male2",
  "male3",
  "female1",
  "female2",
  "female3",
] as const;
export type Avatar = (typeof AVATARS)[number];

// 하위 호환용 — 기존 코드의 Gender 타입 자리. 새 코드에서는 Avatar 사용.
export type Gender = Avatar;

export function NameSetupModal({
  onSubmit,
}: {
  onSubmit: (data: { name: string; gender: Avatar }) => void;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && avatar !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || avatar === null) return;
    onSubmit({ name: trimmed, gender: avatar });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-setup-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
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
            <div className="grid grid-cols-3 gap-2">
              {AVATARS.map((id) => (
                <AvatarCard
                  key={id}
                  id={id}
                  selected={avatar === id}
                  onSelect={() => setAvatar(id)}
                />
              ))}
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

function AvatarCard({
  id,
  selected,
  onSelect,
}: {
  id: Avatar;
  selected: boolean;
  onSelect: () => void;
}) {
  const [errored, setErrored] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={id}
      className={`overflow-hidden rounded-md border transition-colors ${
        selected
          ? "border-zinc-900 ring-2 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
          : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-400"
      }`}
    >
      <div className="flex aspect-square w-full items-center justify-center bg-zinc-50 text-zinc-400 dark:bg-zinc-900/50 dark:text-zinc-600">
        {errored ? (
          <User size={32} weight="duotone" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/images/character/${id}.webp`}
            alt=""
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>
    </button>
  );
}
