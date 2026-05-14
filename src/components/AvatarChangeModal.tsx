"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";
import {
  AvatarPicker,
  type AvatarCategory,
} from "@/adventure/profile/AvatarPicker";
import {
  MONSTER_AVATAR_PREFIX,
  NPC_AVATAR_PREFIX,
  type Avatar,
} from "@/adventure/profile/avatars";
import { useProfile } from "@/adventure/profile/useProfile";
import { useEscapeKey } from "@/lib/useEscapeKey";

// 현재 gender 가 어느 카테고리에 속하는지 — 모달 열 때 초기 탭 결정용.
function categoryOf(id: Avatar): AvatarCategory {
  if (id.startsWith(NPC_AVATAR_PREFIX)) return "npc";
  if (id.startsWith(MONSTER_AVATAR_PREFIX)) return "monster";
  return "character";
}

export function AvatarChangeModal({ onClose }: { onClose: () => void }) {
  const profile = useProfile();
  const initial = profile.gender;
  const [selected, setSelected] = useState<Avatar>(initial);
  const [category, setCategory] = useState<AvatarCategory>(categoryOf(initial));
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose);

  const changed = selected !== initial;
  const canSave = changed && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    setRetrying(false);
    setError(null);
    const result = await profile.submitAvatar(selected, {
      onRetry: () => setRetrying(true),
    });
    if (result.ok) {
      onClose();
      return;
    }
    setSubmitting(false);
    setRetrying(false);
    if (result.reason === "invalid") {
      setError("선택한 이미지가 유효하지 않아요.");
    } else if (result.reason === "network") {
      setError("네트워크가 불안정해요. 연결을 확인하고 다시 시도해주세요.");
    } else {
      setError("서버가 응답하지 않아요. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-change-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="avatar-change-title"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
            >
              프로필 이미지 변경
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              캐릭터·NPC·몬스터 이미지 중에서 골라 프로필을 바꿀 수 있어요.
              이름은 그대로 유지됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="mt-4">
          <AvatarPicker
            category={category}
            onCategoryChange={setCategory}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        {error && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {submitting ? (retrying ? "재시도 중..." : "저장 중...") : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
