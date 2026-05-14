"use client";

import { useEffect, useState } from "react";
import { CheckCircle, User, WarningCircle } from "@phosphor-icons/react";
import type {
  SubmitOptions,
  SubmitResult,
} from "@/adventure/profile/useProfile";
import {
  AVATARS,
  MONSTER_AVATAR_IDS,
  MONSTER_AVATAR_PREFIX,
  NPC_AVATAR_IDS,
  NPC_AVATAR_PREFIX,
  avatarImageSrc,
  type Avatar,
} from "@/adventure/profile/avatars";
import { NPCS } from "@/adventure/data/npcs";
import { TabBar } from "@/components/ui/TabBar";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";

type AvatarCategory = "character" | "npc" | "monster";

const AVATAR_TABS: { key: AvatarCategory; label: string }[] = [
  { key: "character", label: "캐릭터" },
  { key: "npc", label: "NPC" },
  { key: "monster", label: "몬스터" },
];

const AVATAR_PAGE_SIZE = 12; // 3열 × 4행

const CHARACTER_AVATAR_LABELS: Record<string, string> = {
  male1: "남성 1",
  male2: "남성 2",
  male3: "남성 3",
  female1: "여성 1",
  female2: "여성 2",
  female3: "여성 3",
};

const NPC_NAME_BY_ID = new Map<string, string>(
  NPCS.map((n) => [n.id, n.name]),
);

function avatarDisplayName(id: string): string {
  if (id.startsWith(NPC_AVATAR_PREFIX)) {
    const npcId = id.slice(NPC_AVATAR_PREFIX.length);
    return NPC_NAME_BY_ID.get(npcId) ?? npcId;
  }
  if (id.startsWith(MONSTER_AVATAR_PREFIX)) {
    return id.slice(MONSTER_AVATAR_PREFIX.length);
  }
  return CHARACTER_AVATAR_LABELS[id] ?? id;
}

const AVATAR_OPTIONS_BY_CATEGORY: Record<AvatarCategory, readonly string[]> = {
  character: AVATARS,
  npc: NPC_AVATAR_IDS,
  monster: MONSTER_AVATAR_IDS,
};

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

// 캐릭터 생성 폼 — 이름 + 외형. 모달 chrome 없이 순수 폼만 담당하므로
// /create 페이지든 다른 컨테이너든 재사용 가능. 제출 성공 시 onSuccess() 콜백.
export function CreateCharacterForm({
  onSubmit,
  onSuccess,
}: {
  onSubmit: (
    data: { name: string; gender: Avatar },
    options?: SubmitOptions,
  ) => Promise<SubmitResult>;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [category, setCategory] = useState<AvatarCategory>("character");
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
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
    setRetrying(false);
    setSubmitError(null);
    const result = await onSubmit(
      { name: trimmed, gender: avatar },
      { onRetry: () => setRetrying(true) },
    );
    if (result.ok) {
      onSuccess();
      return;
    }
    setSubmitting(false);
    setRetrying(false);
    if (result.reason === "taken") {
      setCheck({ kind: "taken" });
      setSubmitError("이미 사용 중인 이름이에요. 다른 이름으로 시도해주세요.");
    } else if (result.reason === "invalid") {
      setSubmitError("입력값이 유효하지 않아요.");
    } else if (result.reason === "network") {
      setSubmitError(
        "네트워크가 불안정해요. 연결을 확인하고 다시 시도해주세요.",
      );
    } else {
      // server (5xx)
      setSubmitError("서버가 응답하지 않아요. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold">모험가를 만들어보세요</h1>
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
          <AvatarPicker
            category={category}
            onCategoryChange={setCategory}
            selected={avatar}
            onSelect={setAvatar}
          />
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
          {submitting
            ? retrying
              ? "재시도 중..."
              : "저장 중..."
            : "모험 시작"}
        </button>
      </form>
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

function AvatarPicker({
  category,
  onCategoryChange,
  selected,
  onSelect,
}: {
  category: AvatarCategory;
  onCategoryChange: (next: AvatarCategory) => void;
  selected: Avatar | null;
  onSelect: (id: Avatar) => void;
}) {
  // 탭별 후보 목록을 그대로 페이지네이션. 탭 전환 시 1페이지로 리셋한다.
  const options = AVATAR_OPTIONS_BY_CATEGORY[category];
  const pager = usePagination(options as string[], AVATAR_PAGE_SIZE);
  return (
    <div className="space-y-2">
      <TabBar
        tabs={AVATAR_TABS}
        active={category}
        onChange={(next) => {
          onCategoryChange(next);
          pager.setPage(0);
        }}
        ariaLabel="외형 카테고리"
      />
      <div className="grid grid-cols-3 gap-2">
        {pager.pageItems.map((id) => (
          <AvatarOption
            key={id}
            id={id}
            selected={selected === id}
            onSelect={() => onSelect(id)}
          />
        ))}
      </div>
      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        setPage={pager.setPage}
      />
    </div>
  );
}

function AvatarOption({
  id,
  selected,
  onSelect,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [errored, setErrored] = useState(false);
  const label = avatarDisplayName(id);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={label}
      title={label}
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
            src={avatarImageSrc(id)}
            alt=""
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="truncate px-1.5 py-1 text-center text-[11px] leading-tight text-zinc-600 dark:text-zinc-300">
        {label}
      </div>
    </button>
  );
}
