"use client";

import { memo, useEffect, useState } from "react";
import {
  CaretDown,
  CaretRight,
  ChatCircle,
  Heart,
  Trash,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatRelative } from "@/lib/notifications";
import { BULLETIN_CATEGORY_LABELS, BULLETIN_COMMENT_MAX_LENGTH } from "@/lib/bulletin-config";
import {
  deleteComment,
  fetchComments,
  postComment,
  toggleLike,
} from "./api";
import { CATEGORY_BADGE, type BulletinComment, type BulletinPost } from "./types";

// 게시판 글 카드 — 글 헤더(카테고리/제목/작성자/시간) + 본문 + 좋아요·댓글 풋터.
// 좋아요는 optimistic toggle 후 서버 응답으로 확정. 실패 시 rollback.
// 댓글 패널은 펼침 시점에 lazy fetch — 50개 글 카드를 한 번에 펼치지 않는 가정.
//
// memo + 좁힌 prop 시그니처 — 부모가 콜백을 useCallback 으로 안정화하면 같은 post 인
// 카드는 재렌더 skip. 좋아요·댓글 카운트 갱신은 (postId, ...) 좁은 콜백으로 부모가 자체 머지.
type PostCardProps = {
  post: BulletinPost;
  onDelete: (id: number) => void;
  onLikeUpdate: (postId: number, liked: boolean, count: number) => void;
  onCommentCountChange: (postId: number, count: number) => void;
  onRequestSendMessage: (name: string) => void;
};

function PostCardImpl({
  post,
  onDelete,
  onLikeUpdate,
  onCommentCountChange,
  onRequestSendMessage,
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const handleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    // optimistic — 응답이 와도 카운트는 서버 값으로 덮어씀.
    const beforeLiked = post.likedByMe;
    const beforeCount = post.likeCount;
    onLikeUpdate(
      post.id,
      !beforeLiked,
      beforeCount + (beforeLiked ? -1 : 1),
    );
    try {
      const next = await toggleLike(post.id);
      onLikeUpdate(post.id, next.liked, next.count);
    } catch {
      onLikeUpdate(post.id, beforeLiked, beforeCount);
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <li>
      <Card padding="md">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${CATEGORY_BADGE[post.category]}`}
            >
              {BULLETIN_CATEGORY_LABELS[post.category].name}
            </span>
            {post.title && (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {post.title}
              </span>
            )}
            {post.mine ? (
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {post.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRequestSendMessage(post.name)}
                title="쪽지 보내기"
                className="rounded font-semibold text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-200"
              >
                {post.name}
              </button>
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

        <div className="mt-3 flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={handleLike}
            disabled={likeBusy}
            aria-pressed={post.likedByMe}
            aria-label={post.likedByMe ? "좋아요 취소" : "좋아요"}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              post.likedByMe
                ? "text-rose-600 dark:text-rose-400"
                : "text-zinc-500 hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-400"
            }`}
          >
            <Heart
              size={14}
              weight={post.likedByMe ? "fill" : "regular"}
            />
            <span className="tabular-nums">{post.likeCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            aria-expanded={commentsOpen}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {commentsOpen ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
            <ChatCircle size={14} weight="regular" />
            <span className="tabular-nums">{post.commentCount}</span>
          </button>
        </div>

        {commentsOpen && (
          <CommentsPanel
            postId={post.id}
            onCountChange={onCommentCountChange}
            onTargetMessage={onRequestSendMessage}
          />
        )}
      </Card>
    </li>
  );
}

// memo — 부모가 useCallback 으로 콜백을 안정화하고 같은 post 인 카드면 렌더 skip.
// post 는 BulletinBoardView 의 setPosts.map 결과라 좋아요/댓글 카운트 갱신 시 해당 글만 새 객체.
export const PostCard = memo(PostCardImpl);

function CommentsPanel({
  postId,
  onCountChange,
  onTargetMessage,
}: {
  postId: number;
  onCountChange: (postId: number, count: number) => void;
  onTargetMessage: (name: string) => void;
}) {
  const [comments, setComments] = useState<BulletinComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const trimmed = draft.trim();
  const canSubmit =
    trimmed.length > 0 &&
    trimmed.length <= BULLETIN_COMMENT_MAX_LENGTH &&
    !submitting;

  useEffect(() => {
    let cancelled = false;
    fetchComments(postId)
      .then((rows) => {
        if (cancelled) return;
        setComments(rows);
        onCountChange(postId, rows.length);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "불러오기 실패");
      });
    return () => {
      cancelled = true;
    };
    // onCountChange 는 부모 setState 의 closure — 마운트 시 1회만 fetch 하도록 deps 고정.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      const created = await postComment(postId, trimmed);
      setComments((prev) => {
        const next = prev ? [...prev, created] : [created];
        onCountChange(postId, next.length);
        return next;
      });
      setDraft("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "작성 실패";
      setErr(
        msg === "rate limited"
          ? "너무 빠르게 댓글을 달고 있어요. 잠시 후 다시 시도해주세요."
          : msg,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (commentId: number) => {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    try {
      await deleteComment(postId, commentId);
      setComments((prev) => {
        const next = prev?.filter((c) => c.id !== commentId) ?? null;
        if (next) onCountChange(postId, next.length);
        return next;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      {comments === null ? (
        <Skeleton rows={2} />
      ) : comments.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          아직 댓글이 없습니다.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {comments.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-2 rounded-md bg-zinc-50/70 px-2.5 py-1.5 dark:bg-zinc-900/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                  {c.mine ? (
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                      {c.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onTargetMessage(c.name)}
                      title="쪽지 보내기"
                      className="rounded font-semibold text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-200"
                    >
                      {c.name}
                    </button>
                  )}
                  <span>{formatRelative(c.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-200">
                  {c.content}
                </p>
              </div>
              {c.mine && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label="댓글 삭제"
                  className="shrink-0 rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                >
                  <Trash size={12} weight="bold" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={1}
          maxLength={BULLETIN_COMMENT_MAX_LENGTH + 50}
          placeholder="댓글 달기"
          disabled={submitting}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="min-h-[40px] flex-1 resize-none rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="shrink-0 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          등록
        </button>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span
          className={
            trimmed.length > BULLETIN_COMMENT_MAX_LENGTH
              ? "text-rose-600"
              : "text-zinc-500 dark:text-zinc-400"
          }
        >
          {trimmed.length} / {BULLETIN_COMMENT_MAX_LENGTH}
        </span>
        {err && <span className="text-rose-600">{err}</span>}
      </div>
    </div>
  );
}
