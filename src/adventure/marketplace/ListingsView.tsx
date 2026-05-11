"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Storefront } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TabBar } from "@/components/ui/TabBar";
import { Pagination } from "@/components/ui/Pagination";
import { LIST_ROW } from "@/components/ui/listRow";
import { usePagination } from "@/lib/usePagination";
import { formatRelativeTime } from "@/lib/format";
import { ITEMS, rarityTextClass, type ItemId } from "@/adventure/data/items";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { POTIONS } from "@/adventure/data/potions";
import { getRecipeById } from "@/adventure/data/recipes";
import { craftVarianceSummary } from "@/adventure/data/craftQuality";
import { fetchListings } from "./api";
import type { ItemKind, Listing, SortMode } from "./types";

// 매물 카드를 클릭하면 펼쳐 보여줄 상세 — 장비 옵션 / 제작서 결과 / 재료 설명.
type ListingDetail = {
  title?: string;
  lines: { label: string; value: string }[];
  /** 제작 품질 변동 안내 ("공격력 +6~+10" 식). */
  variance?: string;
  description?: string;
};

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function listingDetail(item: Listing): ListingDetail | null {
  if (item.itemKind === "equip") {
    if (!hasOwn(ITEMS, item.itemId)) return null;
    const def = ITEMS[item.itemId as ItemId];
    // 스탯은 행에 인라인으로 보여주므로(가방과 동일) 펼침 패널엔 설명만.
    if (!def.description) return null;
    return { lines: [], description: def.description };
  }
  if (item.itemKind === "recipe") {
    const r = getRecipeById(item.itemId);
    if (!r) return null;
    if (r.result.kind === "equipment") {
      const def = ITEMS[r.result.itemId];
      return {
        title: `제작 결과: ${def.name}`,
        lines: [...def.stats],
        variance: craftVarianceSummary(def, r) ?? undefined,
        description: def.description,
      };
    }
    const p = POTIONS[r.result.potionId];
    const qty = r.result.quantity;
    return {
      title: `제작 결과: ${p.name}${qty > 1 ? ` ×${qty}` : ""}`,
      lines: [],
      description: p.description,
    };
  }
  if (item.itemKind === "material") {
    if (!hasOwn(MATERIALS, item.itemId)) return null;
    return { lines: [], description: MATERIALS[item.itemId as MaterialId].description };
  }
  return null;
}

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

  const pager = usePagination(items, 10);

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
          <ul className="space-y-1.5">
            {pager.pageItems.map((it) => (
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
          </ul>
          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            setPage={pager.setPage}
          />
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
  const [open, setOpen] = useState(false);
  const insufficientGold =
    typeof currentGold === "number" && currentGold < item.price;
  const blocked = alreadyKnown === true;
  const isRecipe = item.itemKind === "recipe";
  // 장비 매물이면 등급색으로 강조 + 스탯을 행에 인라인 표시 — 다른 종류는 기본 zinc 톤.
  const equipDef =
    item.itemKind === "equip" && hasOwn(ITEMS, item.itemId)
      ? ITEMS[item.itemId as ItemId]
      : null;
  const nameClass = rarityTextClass(equipDef, "text-zinc-900 dark:text-zinc-100");
  const detail = listingDetail(item);
  return (
    <li className={LIST_ROW}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span
              className={`text-sm font-medium ${nameClass} ${
                detail
                  ? "cursor-pointer underline decoration-dotted decoration-zinc-400 underline-offset-2"
                  : ""
              }`}
              role={detail ? "button" : undefined}
              tabIndex={detail ? 0 : undefined}
              aria-expanded={detail ? open : undefined}
              onClick={detail ? () => setOpen((v) => !v) : undefined}
              onKeyDown={
                detail
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpen((v) => !v);
                      }
                    }
                  : undefined
              }
            >
              {isRecipe ? "📜 " : ""}
              {item.itemName}
            </span>
            {item.itemKind === "material" && item.quantity > 1 ? (
              <span className="text-xs tabular-nums text-zinc-500">
                ×{item.quantity}
              </span>
            ) : null}
            {item.isMine ? (
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                내 매물
              </span>
            ) : null}
            {blocked ? (
              <span className="text-[10px] text-zinc-500">이미 알고 있음</span>
            ) : null}
          </div>
          {equipDef ? (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              {equipDef.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}
            </div>
          ) : null}
          <div className="text-[11px] text-zinc-500">
            {formatRelativeTime(item.createdAt)}
            {(() => {
              // 등록 24시간 만료 — 4시간 이하 남았으면 임박 뱃지 노출.
              // 시간 기반 1회성 표시라 Date.now() 가 매 렌더 다른 값이어도 무해.
              // eslint-disable-next-line react-hooks/purity
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
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
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
              className="rounded-md border border-red-300 bg-white px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              {busy ? "취소 중…" : "취소"}
            </button>
          ) : item.isMine ? null : onBuy ? (
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
                  ? "cursor-not-allowed rounded-md border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                  : "rounded-md border border-emerald-700 bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
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
        </div>
      </div>
      {open && detail ? (
        <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          {detail.title ? (
            <div className="mb-1 font-medium text-zinc-700 dark:text-zinc-300">
              {detail.title}
            </div>
          ) : null}
          {detail.lines.length > 0 ? (
            <div className="space-y-0.5">
              {detail.lines.map((s) => (
                <div
                  key={s.label}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {s.label}
                  </span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {detail.variance ? (
            <div className="mt-1 text-sky-600 dark:text-sky-400">
              품질에 따라 변동 — {detail.variance}
            </div>
          ) : null}
          {detail.description ? (
            <div className="mt-1.5 border-t border-zinc-200 pt-1.5 italic text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {detail.description}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
