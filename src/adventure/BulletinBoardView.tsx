"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MagnifyingGlass,
  Megaphone,
  Note,
  PaperPlaneTilt,
  Trash,
  X,
} from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { TabBar } from "@/components/ui/TabBar";
import { usePagination } from "@/lib/usePagination";
import { formatRelative } from "@/lib/notifications";
import {
  BULLETIN_CATEGORIES,
  BULLETIN_CATEGORY_LABELS,
  BULLETIN_MAX_LENGTH,
  BULLETIN_TITLE_MAX_LENGTH,
  USER_WRITABLE_CATEGORIES,
  type BulletinCategory,
} from "@/lib/bulletin-config";
import { SendMessageModal } from "@/adventure/marketplace/SendMessageModal";

type BulletinPost = {
  id: number;
  name: string;
  className: string;
  category: BulletinCategory;
  title: string | null;
  content: string;
  createdAt: number;
  mine: boolean;
};

async function fetchPosts(
  category: BulletinCategory,
  q: string,
): Promise<BulletinPost[]> {
  const params = new URLSearchParams({ category });
  if (q) params.set("q", q);
  const res = await fetch(`/api/bulletin?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json();
}

async function fetchPermissions(): Promise<{ isAdmin: boolean }> {
  const res = await fetch("/api/bulletin/permissions", { cache: "no-store" });
  if (!res.ok) return { isAdmin: false };
  return res.json();
}

async function postPost(input: {
  category: BulletinCategory;
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

// 카테고리 배지 — 글 카드 상단 라벨용. 카테고리별 톤 분리.
const CATEGORY_BADGE: Record<BulletinCategory, string> = {
  notice:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  free: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  guide:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
};

export function BulletinBoardView() {
  const [category, setCategory] = useState<BulletinCategory>("notice");
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [posts, setPosts] = useState<BulletinPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pmTarget, setPmTarget] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // 검색어 debounce — 입력마다 fetch 하지 않고 250ms 멈춤 후 1회.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchPosts(category, debouncedQ);
      setPosts(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    }
  }, [category, debouncedQ]);

  useEffect(() => {
    // 카테고리/검색어 변경마다 fetch — 명시적 의존 외부 변경.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosts(null);
    refresh();
  }, [refresh]);

  // 권한 — 마운트 1회.
  useEffect(() => {
    fetchPermissions()
      .then((p) => setIsAdmin(p.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  const handleSubmit = async (input: {
    category: BulletinCategory;
    title: string | null;
    content: string;
  }) => {
    try {
      const created = await postPost(input);
      // 작성한 카테고리가 현재 탭과 같으면 즉시 반영, 다르면 그 탭으로 이동.
      if (created.category === category) {
        setPosts((prev) => (prev ? [created, ...prev] : [created]));
      } else {
        setCategory(created.category);
      }
      setComposerOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "작성 실패";
      if (msg === "rate limited") {
        throw new Error("너무 자주 글을 올리고 있어요. 잠시 후 다시 시도해주세요.");
      }
      if (msg === "forbidden") {
        throw new Error("이 카테고리에 글을 쓸 권한이 없어요.");
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

  const pager = usePagination(posts ?? [], 10);

  const tabs = useMemo(
    () =>
      BULLETIN_CATEGORIES.map((c) => ({
        key: c,
        label: BULLETIN_CATEGORY_LABELS[c].name,
      })),
    [],
  );

  return (
    <div className="space-y-3">
      <TabBar
        tabs={tabs}
        active={category}
        onChange={setCategory}
        ariaLabel="게시판 카테고리"
        size="sm"
        scrollable
      />

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {BULLETIN_CATEGORY_LABELS[category].description}
      </p>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={14}
            weight="bold"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목·내용 검색"
            className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-7 pr-3 text-sm outline-none transition-colors focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
          />
        </div>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
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
          icon={
            category === "notice" ? (
              <Megaphone size={40} weight="duotone" />
            ) : (
              <Note size={40} weight="duotone" />
            )
          }
          title={
            debouncedQ
              ? "검색 결과가 없습니다"
              : category === "notice"
                ? "공지가 없습니다"
                : "아직 글이 없습니다"
          }
          message={
            debouncedQ
              ? "다른 검색어를 시도해 보세요."
              : category === "notice"
                ? "운영자가 새 공지를 올리면 여기에 표시됩니다."
                : "첫 글을 남겨 보세요."
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {pager.pageItems.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onDelete={handleDelete}
                onSendMessage={p.mine ? undefined : () => setPmTarget(p.name)}
              />
            ))}
          </ul>
          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            setPage={pager.setPage}
          />
        </>
      )}

      {composerOpen && (
        <Composer
          initialCategory={category === "notice" && !isAdmin ? "free" : category}
          isAdmin={isAdmin}
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
  initialCategory,
  isAdmin,
  onClose,
  onSubmit,
}: {
  initialCategory: BulletinCategory;
  isAdmin: boolean;
  onClose: () => void;
  onSubmit: (input: {
    category: BulletinCategory;
    title: string | null;
    content: string;
  }) => Promise<void>;
}) {
  const [category, setCategory] = useState<BulletinCategory>(initialCategory);
  const [titleDraft, setTitleDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const trimmed = draft.trim();
  const trimmedTitle = titleDraft.trim();
  const canSubmit =
    trimmed.length > 0 && trimmed.length <= BULLETIN_MAX_LENGTH && !submitting;

  // 작성 가능 카테고리 — admin 은 전체, 일반 유저는 USER_WRITABLE_CATEGORIES.
  const selectableCategories: ReadonlyArray<BulletinCategory> = isAdmin
    ? BULLETIN_CATEGORIES
    : USER_WRITABLE_CATEGORIES;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit({
        category,
        title: trimmedTitle || null,
        content: trimmed,
      });
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

        <div className="mt-3 flex flex-wrap gap-1.5">
          {selectableCategories.map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                disabled={submitting}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {BULLETIN_CATEGORY_LABELS[c].name}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          maxLength={BULLETIN_TITLE_MAX_LENGTH + 10}
          placeholder={`제목 (선택, 최대 ${BULLETIN_TITLE_MAX_LENGTH}자)`}
          disabled={submitting}
          className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          autoFocus
          maxLength={BULLETIN_MAX_LENGTH + 100}
          placeholder="게시판에 남길 글을 입력하세요"
          disabled={submitting}
          className="mt-2 w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
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
