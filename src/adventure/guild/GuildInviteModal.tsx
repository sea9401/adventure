"use client";

import { useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { useModalA11y } from "@/lib/useModalA11y";
import { GuildError, inviteToGuild } from "./api";

type Props = {
  guildId: number;
  onClose: () => void;
  onSuccess: (targetName: string) => void;
};

export function GuildInviteModal({ guildId, onClose, onSuccess }: Props) {
  useEscapeKey(onClose);
  const contentRef = useRef<HTMLDivElement>(null);
  useModalA11y(contentRef);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      const r = await inviteToGuild(guildId, trimmed);
      onSuccess(r.targetName);
    } catch (e) {
      const msg =
        e instanceof GuildError
          ? e.message
          : e instanceof Error
            ? e.message
            : "초대 실패";
      setErr(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guild-invite-title"
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
    >
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between">
          <h2
            id="guild-invite-title"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
          >
            멤버 초대
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          닉네임으로 초대장을 우편으로 보냅니다. 7일 안에 수락하지 않으면 만료됩니다.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mt-3 space-y-3"
        >
          <label htmlFor="guild-invite-name" className="sr-only">
            초대할 닉네임
          </label>
          <input
            id="guild-invite-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            placeholder="닉네임"
            autoFocus
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          {err ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">{err}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "전송 중…" : "초대장 보내기"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
