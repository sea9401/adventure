"use client";

import { useEffect, useState } from "react";
import { CheckCircle, User, WarningCircle } from "@phosphor-icons/react";
import type { SubmitResult } from "@/adventure/profile/useProfile";

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

const NAME_MIN = 1;
const NAME_MAX = 16;
const CHECK_DEBOUNCE_MS = 400;

type CheckState =
  | { kind: "idle" }
  | { kind: "tooLong" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "error" };

export function NameSetupModal({
  onSubmit,
}: {
  onSubmit: (data: { name: string; gender: Avatar }) => Promise<SubmitResult>;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const trimmed = name.trim();

  // 입력 변경 시 debounce 후 가용성 체크. 컴포넌트 unmount/입력 변경 시 fetch 결과는 무시.
  // 외부 입력(name)을 관찰해 check 상태로 매핑 — 의도적 set-state-in-effect.
  useEffect(() => {
    if (trimmed.length < NAME_MIN) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCheck({ kind: "idle" });
      return;
    }
    if (trimmed.length > NAME_MAX) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCheck({ kind: "tooLong" });
      return;
    }
    setCheck({ kind: "checking" });
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/profile/check-name?name=${encodeURIComponent(trimmed)}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setCheck({ kind: "error" });
          return;
        }
        const data = (await res.json()) as { available: boolean };
        setCheck({ kind: data.available ? "available" : "taken" });
      } catch {
        if (!cancelled) setCheck({ kind: "error" });
      }
    }, CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed]);

  const canSubmit =
    avatar !== null && check.kind === "available" && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || avatar === null) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await onSubmit({ name: trimmed, gender: avatar });
    if (result.ok) {
      // needsSetup=false 가 되어 부모가 모달 unmount — 별도 처리 불필요.
      return;
    }
    setSubmitting(false);
    if (result.reason === "taken") {
      setCheck({ kind: "taken" });
      setSubmitError("이미 사용 중인 이름이에요. 다른 이름으로 시도해주세요.");
    } else if (result.reason === "invalid") {
      setSubmitError("입력값이 유효하지 않아요.");
    } else {
      setSubmitError("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
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
              maxLength={NAME_MAX}
              autoFocus
              disabled={submitting}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none transition-colors focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
            />
            <NameCheckIndicator state={check} />
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
          {submitError && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-base font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {submitting ? "저장 중..." : "모험 시작"}
          </button>
        </form>
      </div>
    </div>
  );
}

function NameCheckIndicator({ state }: { state: CheckState }) {
  if (state.kind === "idle") {
    return (
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        1~16자, 다른 모험가와 겹치지 않는 이름으로 정해주세요.
      </p>
    );
  }
  if (state.kind === "tooLong") {
    return (
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        1~16자로 입력해주세요.
      </p>
    );
  }
  if (state.kind === "checking") {
    return (
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        확인 중...
      </p>
    );
  }
  if (state.kind === "available") {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle size={14} weight="fill" />
        사용 가능한 이름이에요.
      </p>
    );
  }
  if (state.kind === "taken") {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
        <WarningCircle size={14} weight="fill" />
        이미 사용 중인 이름이에요.
      </p>
    );
  }
  return (
    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
      <WarningCircle size={14} weight="fill" />
      확인하지 못했어요. 잠시 후 다시 시도해주세요.
    </p>
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
