"use client";

import { useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";
import { USER_MESSAGE_MAX_LENGTH } from "@/lib/inbox-config";
import { RECIPES } from "@/adventure/data/recipes";
import { useGame } from "@/adventure/GameContext";
import { sendUserMessage } from "./api";
import { useEscapeKey } from "@/lib/useEscapeKey";

type Props = {
  initialRecipient?: string;
  onClose: () => void;
  onSent?: (recipientName: string) => void;
};

export function SendMessageModal({
  initialRecipient = "",
  onClose,
  onSent,
}: Props) {
  useEscapeKey(onClose);
  const { crafting } = useGame();
  const shareableRecipes = crafting.state.shareable;
  const consumeShare = crafting.consumeShare;
  const [recipient, setRecipient] = useState(initialRecipient);
  const [draft, setDraft] = useState("");
  const [attachedRecipeId, setAttachedRecipeId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 공유 토큰을 보유한 레시피만 선물 가능 — 이미 공유에 쓴 건 다시 습득해야 충전.
  const giftable = useMemo(
    () =>
      RECIPES.filter(
        (r) => r.tradable !== false && shareableRecipes.includes(r.id),
      ),
    [shareableRecipes],
  );

  const trimmedRecipient = recipient.trim();
  const trimmedDraft = draft.trim();
  // 첨부가 있으면 본문 비어도 전송 가능.
  const canSubmit =
    trimmedRecipient.length > 0 &&
    (attachedRecipeId !== null || trimmedDraft.length > 0) &&
    trimmedDraft.length <= USER_MESSAGE_MAX_LENGTH &&
    !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      const r = await sendUserMessage(
        trimmedRecipient,
        trimmedDraft,
        attachedRecipeId,
      );
      // 서버가 토큰 차감 성공 → 클라 로컬 상태도 동일 변경.
      if (attachedRecipeId) consumeShare(attachedRecipeId);
      onSent?.(r.recipientName);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "전송 실패");
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            쪽지 보내기
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <label className="mt-3 block text-xs text-zinc-600 dark:text-zinc-400">
          받는 사람 (닉네임)
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          autoFocus={initialRecipient.length === 0}
          disabled={submitting}
          maxLength={64}
          placeholder="닉네임"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />

        <label className="mt-3 block text-xs text-zinc-600 dark:text-zinc-400">
          내용
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          autoFocus={initialRecipient.length > 0}
          maxLength={USER_MESSAGE_MAX_LENGTH + 50}
          placeholder="간단한 쪽지를 적어보세요"
          disabled={submitting}
          className="mt-1 w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span
            className={
              trimmedDraft.length > USER_MESSAGE_MAX_LENGTH
                ? "text-rose-600"
                : "text-zinc-500 dark:text-zinc-400"
            }
          >
            {trimmedDraft.length} / {USER_MESSAGE_MAX_LENGTH}
          </span>
          {err && <span className="text-rose-600">{err}</span>}
        </div>

        {giftable.length > 0 && (
          <>
            <label className="mt-3 block text-xs text-zinc-600 dark:text-zinc-400">
              제작서 첨부 (선물 — 무료)
            </label>
            <select
              value={attachedRecipeId ?? ""}
              onChange={(e) =>
                setAttachedRecipeId(e.target.value ? e.target.value : null)
              }
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">— 첨부 없음 —</option>
              {giftable.map((r) => (
                <option key={r.id} value={r.id}>
                  📜 {r.name}
                </option>
              ))}
            </select>
            {attachedRecipeId ? (
              <p className="mt-1 text-[11px] text-zinc-500">
                상대가 이미 알고 있는 제작서면 자동으로 무시됩니다.
              </p>
            ) : null}
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "전송 중…" : "전송"}
          </button>
        </div>
      </div>
    </div>
  );
}
