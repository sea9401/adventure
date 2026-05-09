"use client";

import { useCallback, useEffect, useState } from "react";
import { Note, PaperPlaneTilt, Trash, X } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatRelative } from "@/lib/notifications";
import { BULLETIN_MAX_LENGTH } from "@/lib/bulletin-config";
import { SendMessageModal } from "@/adventure/marketplace/SendMessageModal";

type BulletinPost = {
  id: number;
  name: string;
  className: string;
  title: string | null;
  content: string;
  createdAt: number;
  mine: boolean;
};

async function fetchPosts(): Promise<BulletinPost[]> {
  const res = await fetch("/api/bulletin", { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json();
}

async function postPost(input: {
  name: string;
  className: string;
  title: string | null;
  content: string;
}): Promise<BulletinPost> {
  const res = await fetch("/api/bulletin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `post failed: ${res.status}`);
  }
  return res.json();
}

async function deletePost(id: number): Promise<void> {
  const res = await fetch(`/api/bulletin?id=${id}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `delete failed: ${res.status}`);
  }
}

export function BulletinBoardView({
  name,
  className,
  title,
}: {
  name: string;
  className: string;
  title: string | null;
}) {
  const [posts, setPosts] = useState<BulletinPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pmTarget, setPmTarget] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchPosts();
      setPosts(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSubmit = async (content: string) => {
    try {
      const created = await postPost({ name, className, title, content });
      setPosts((prev) => (prev ? [created, ...prev] : [created]));
      setComposerOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "작성 실패";
      // rate limit 메시지를 좀 더 친화적으로.
      if (msg === "rate limited") {
        throw new Error("너무 자주 글을 올리고 있어요. 잠시 후 다시 시도해주세요.");
      }
      throw new Error(msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 글을 삭제할까요?")) return;
    try {
      await deletePost(id);
      setPosts((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          최대 {BULLETIN_MAX_LENGTH}자, 7일 후 자동 삭제됩니다.
        </p>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <PaperPlaneTilt size={14} weight="fill" />
          글쓰기
        </button>
      </div>

      {error ? (
        <Card padding="sm">
          <div className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        </Card>
      ) : null}

      {posts === null ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="rounded-lg border border-zinc-200 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/60"
            >
              <Skeleton rows={2} />
            </li>
          ))}
        </ul>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Note size={40} weight="duotone" />}
          title="아직 글이 없습니다"
          message="첫 글을 남겨 보세요."
        />
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onDelete={handleDelete}
              onSendMessage={p.mine ? undefined : () => setPmTarget(p.name)}
            />
          ))}
        </ul>
      )}

      {composerOpen && (
        <Composer
          onClose={() => setComposerOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {pmTarget && (
        <SendMessageModal
          initialRecipient={pmTarget}
          onClose={() => setPmTarget(null)}
        />
      )}
    </div>
  );
}

function PostCard({
  post,
  onDelete,
  onSendMessage,
}: {
  post: BulletinPost;
  onDelete: (id: number) => void;
  onSendMessage?: () => void;
}) {
  return (
    <li>
      <Card padding="md">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {post.title && (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {post.title}
              </span>
            )}
            {onSendMessage ? (
              <button
                type="button"
                onClick={onSendMessage}
                title="쪽지 보내기"
                className="rounded font-semibold text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-200"
              >
                {post.name}
              </button>
            ) : (
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {post.name}
              </span>
            )}
            <span>{formatRelative(post.createdAt)}</span>
          </div>
          {post.mine && (
            <button
              type="button"
              onClick={() => onDelete(post.id)}
              aria-label="글 삭제"
              className="shrink-0 rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            >
              <Trash size={14} weight="bold" />
            </button>
          )}
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-200">
          {post.content}
        </p>
      </Card>
    </li>
  );
}

function Composer({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const trimmed = draft.trim();
  const canSubmit =
    trimmed.length > 0 && trimmed.length <= BULLETIN_MAX_LENGTH && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit(trimmed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "작성 실패");
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
            새 글 쓰기
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

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          autoFocus
          maxLength={BULLETIN_MAX_LENGTH + 100}
          placeholder="광장에 남길 글을 입력하세요"
          disabled={submitting}
          className="mt-3 w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span
            className={
              trimmed.length > BULLETIN_MAX_LENGTH
                ? "text-rose-600"
                : "text-zinc-500 dark:text-zinc-400"
            }
          >
            {trimmed.length} / {BULLETIN_MAX_LENGTH}
          </span>
          {err && <span className="text-rose-600">{err}</span>}
        </div>

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
            {submitting ? "등록 중…" : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
