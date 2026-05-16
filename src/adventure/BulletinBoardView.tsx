"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MagnifyingGlass,
  Megaphone,
  Note,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { TabBar } from "@/components/ui/TabBar";
import { usePagination } from "@/lib/usePagination";
import {
  BULLETIN_CATEGORIES,
  BULLETIN_CATEGORY_LABELS,
  type BulletinCategory,
} from "@/lib/bulletin-config";
import { SendMessageModal } from "@/adventure/marketplace/SendMessageModal";
import {
  deletePost,
  fetchPermissions,
  fetchPosts,
  postPost,
} from "./bulletin/api";
import { ComposePage } from "./bulletin/ComposePage";
import { PostCard } from "./bulletin/PostCard";
import type { BulletinPost } from "./bulletin/types";

// 게시판 본체 — 탭(카테고리) + 검색 + 목록/페이지네이션, 그리고 글쓰기 화면 전환 라우터.
// 글 카드 렌더링·좋아요·댓글은 PostCard 로, 글쓰기 폼은 ComposePage 로, fetch helper 는 ./bulletin/api 로 분리.
export function BulletinBoardView() {
  const [category, setCategory] = useState<BulletinCategory>("notice");
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [posts, setPosts] = useState<BulletinPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "list" = 목록 화면, "compose" = 글쓰기 페이지. 별도 라우트 대신 같은 view 안에서 모드 전환.
  // 글쓰기는 모바일에서 모달이 답답해 별개 페이지로 전환 (textarea 풀화면 가능).
  const [mode, setMode] = useState<"list" | "compose">("list");
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
      setMode("list");
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

  if (mode === "compose") {
    return (
      <ComposePage
        initialCategory={category === "notice" && !isAdmin ? "free" : category}
        isAdmin={isAdmin}
        onCancel={() => setMode("list")}
        onSubmit={handleSubmit}
      />
    );
  }

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
          onClick={() => setMode("compose")}
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
                onPostChange={(next) =>
                  setPosts(
                    (prev) =>
                      prev?.map((x) => (x.id === next.id ? next : x)) ?? null,
                  )
                }
                onCommentTargetMessage={(name) => setPmTarget(name)}
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

      {pmTarget && (
        <SendMessageModal
          initialRecipient={pmTarget}
          onClose={() => setPmTarget(null)}
        />
      )}
    </div>
  );
}
