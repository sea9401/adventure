"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Storefront } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TabBar } from "@/components/ui/TabBar";
import { formatRelativeTime } from "@/lib/format";
import { fetchListings } from "./api";
import type { ItemKind, Listing, SortMode } from "./types";

type KindFilter = "all" | ItemKind;

const KIND_TABS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "equip", label: "장비" },
  { key: "material", label: "재료" },
  { key: "recipe", label: "제작서" },
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "recent", label: "최신순" },
  { value: "price_asc", label: "가격↑" },
  { value: "price_desc", label: "가격↓" },
];

export function ListingsView({
  refreshKey,
  onCancelListing,
  onBuyListing,
  mineOnly = false,
  currentGold,
  knownRecipes,
}: {
  refreshKey: number;
  onCancelListing?: (listing: Listing) => Promise<void>;
  onBuyListing?: (listing: Listing) => Promise<void>;
  mineOnly?: boolean;
  currentGold?: number;
  knownRecipes?: string[];
}) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortMode>("recent");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const [items, setItems] = useState<Listing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetchListings(
          { kind, sort, q: submitted, mine: mineOnly },
          signal,
        );
        if (signal?.aborted) return;
        setItems(r.items);
        setNextCursor(r.nextCursor);
      } catch (e) {
        if (signal?.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "로드 실패");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [kind, sort, submitted, mineOnly],
  );

  useEffect(() => {
    // 의존성(필터/정렬/검색)이 빠르게 바뀔 때 늦게 도착한 응답이 최신 결과를 덮어쓰지
    // 않도록 AbortController 로 이전 fetch 를 취소.
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  // 창에 포커스 돌아왔을 때 자동 새로고침. 짧은 시간(<10s) 안의 중복은 스킵.
  // useRef 초기값은 순수해야 하므로 Date.now() 는 effect 에서 세팅.
  const lastLoadedAt = useRef<number>(0);
  useEffect(() => {
    lastLoadedAt.current = Date.now();
  }, [items]);
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastLoadedAt.current < 10_000) return;
      void load();
    };
    const onVisible = () => {
      if (!document.hidden) onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await fetchListings({
        kind,
        sort,
        q: submitted,
        mine: mineOnly,
        cursor: nextCursor,
      });
      setItems((prev) => [...prev, ...r.items]);
      setNextCursor(r.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "더 불러오기 실패");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card padding="sm">
        <TabBar
          tabs={KIND_TABS}
          active={kind}
          onChange={setKind}
          ariaLabel="아이템 종류 필터"
          size="sm"
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="아이템 이름 검색"
            className="flex-1 min-w-[140px] rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          >
            검색
          </button>
        </form>
      </Card>

      {error ? (
        <Card padding="sm">
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        </Card>
      ) : null}

      {loading && items.length === 0 ? (
        <Card padding="md">
          <div className="text-sm text-zinc-500">로딩…</div>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Storefront size={40} weight="duotone" />}
          title="등록된 매물이 없습니다"
          message={submitted ? "검색어를 바꿔 보세요." : "첫 매물을 등록해 보세요."}
        />
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <ListingCard
              key={it.id}
              item={it}
              onCancel={onCancelListing}
              onBuy={onBuyListing}
              currentGold={currentGold}
              alreadyKnown={
                it.itemKind === "recipe" &&
                !!knownRecipes?.includes(it.itemId)
              }
            />
          ))}
        </div>
      )}

      {nextCursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {loadingMore ? "더 불러오는 중…" : "더 보기"}
        </button>
      ) : null}
    </div>
  );
}

function ListingCard({
  item,
  onCancel,
  onBuy,
  currentGold,
  alreadyKnown,
}: {
  item: Listing;
  onCancel?: (listing: Listing) => Promise<void>;
  onBuy?: (listing: Listing) => Promise<void>;
  currentGold?: number;
  alreadyKnown?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const insufficientGold =
    typeof currentGold === "number" && currentGold < item.price;
  const blocked = alreadyKnown === true;
  const isRecipe = item.itemKind === "recipe";
  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {isRecipe ? "📜 " : ""}
            {item.itemName}
            {item.itemKind === "material" && item.quantity > 1 ? (
              <span className="ml-1 text-zinc-500">×{item.quantity}</span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-[11px] text-zinc-500">
            {formatRelativeTime(item.createdAt)}
            {(() => {
              // 등록 24시간 만료 — 4시간 이하 남았으면 임박 뱃지 노출.
              const ageMs = Date.now() - new Date(item.createdAt).getTime();
              const remainMs = 24 * 60 * 60 * 1000 - ageMs;
              if (remainMs > 0 && remainMs < 4 * 60 * 60 * 1000) {
                const hours = Math.max(1, Math.round(remainMs / (60 * 60 * 1000)));
                return (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    {hours}시간 후 만료
                  </span>
                );
              }
              return null;
            })()}
            {item.isMine ? (
              <span className="ml-2 text-emerald-600">내 매물</span>
            ) : null}
            {blocked ? (
              <span className="ml-2 text-zinc-500">이미 알고 있음</span>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-base font-semibold text-amber-700 dark:text-amber-400">
            {item.price.toLocaleString()} G
          </span>
          {item.isMine && onCancel ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onCancel(item);
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-1 rounded-md border border-red-300 bg-white px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              {busy ? "취소 중…" : "취소"}
            </button>
          ) : item.isMine ? (
            <span className="mt-1 block text-[10px] text-zinc-500">내 매물</span>
          ) : onBuy ? (
            <button
              type="button"
              disabled={busy || insufficientGold || blocked}
              title={
                blocked
                  ? "이미 알고 있는 제작서"
                  : insufficientGold
                    ? "골드 부족"
                    : undefined
              }
              onClick={async () => {
                setBusy(true);
                try {
                  await onBuy(item);
                } finally {
                  setBusy(false);
                }
              }}
              className={
                insufficientGold || blocked
                  ? "mt-1 cursor-not-allowed rounded-md border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                  : "mt-1 rounded-md border border-emerald-700 bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              }
            >
              {busy
                ? "구매 중…"
                : blocked
                  ? "이미 보유"
                  : insufficientGold
                    ? "골드 부족"
                    : "구매"}
            </button>
          ) : null}
        </span>
      </div>
    </Card>
  );
}
