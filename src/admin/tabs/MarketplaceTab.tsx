"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../AdminContext";
import { Button, Field, Select, TextInput } from "../ui/Field";

type Status = "active" | "sold" | "cancelled";

type AdminListing = {
  id: number;
  sellerId: string;
  sellerName: string;
  buyerId: string | null;
  itemKind: "equip" | "material";
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  status: Status;
  createdAt: string;
  closedAt: string | null;
};

type Summary = Partial<Record<Status, number>>;

const STATUS_OPTIONS: { value: "all" | Status; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "활성" },
  { value: "sold", label: "판매됨" },
  { value: "cancelled", label: "취소됨" },
];

const KIND_OPTIONS: { value: "" | "equip" | "material"; label: string }[] = [
  { value: "", label: "전체" },
  { value: "equip", label: "장비" },
  { value: "material", label: "재료" },
];

function formatTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return new Date(iso).toLocaleString("ko-KR");
}

export function MarketplaceTab() {
  const { readOnly, showToast } = useAdmin();

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("active");
  const [kindFilter, setKindFilter] = useState<"" | "equip" | "material">("");

  const [items, setItems] = useState<AdminListing[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(
        "/api/admin/marketplace/listings",
        window.location.origin,
      );
      if (statusFilter !== "all") url.searchParams.set("status", statusFilter);
      if (kindFilter) url.searchParams.set("kind", kindFilter);
      if (submitted) url.searchParams.set("q", submitted);
      const r = await fetch(url.toString());
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as {
        items: AdminListing[];
        summary: Summary;
        nextCursor: string | null;
      };
      setItems(data.items);
      setSummary(data.summary);
      setNextCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, kindFilter, submitted]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const forceCancel = async (listing: AdminListing) => {
    const note = window.prompt(
      `${listing.itemName} (id=${listing.id}) 강제 취소 사유 (선택, 판매자 우편함에 표시):`,
      "",
    );
    if (note === null) return; // 사용자가 cancel
    try {
      const url = new URL(
        "/api/admin/marketplace/listings",
        window.location.origin,
      );
      url.searchParams.set("id", String(listing.id));
      if (note.trim()) url.searchParams.set("note", note.trim());
      const r = await fetch(url.toString(), { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      showToast(
        `${listing.itemName} (id=${listing.id}) 강제 취소 — 판매자 우편함에 환불 적재`,
      );
      void load();
    } catch (e) {
      showToast(`실패: ${e instanceof Error ? e.message : "오류"}`);
    }
  };

  return (
    <div className="space-y-3">
      <section className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">거래소 listing</h2>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-500">
          <span>활성 {summary.active ?? 0}</span>
          <span>판매됨 {summary.sold ?? 0}</span>
          <span>취소됨 {summary.cancelled ?? 0}</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
          className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]"
        >
          <Field label="검색 (아이템 이름 또는 판매자명)">
            <TextInput value={query} onChange={setQuery} />
          </Field>
          <Field label="상태">
            <Select
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => setStatusFilter(v)}
            />
          </Field>
          <Field label="종류">
            <Select
              value={kindFilter}
              options={KIND_OPTIONS}
              onChange={(v) => setKindFilter(v)}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={loading}>
              검색
            </Button>
          </div>
        </form>
        {error ? (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading && items.length === 0 ? (
          <div className="px-3 py-2 text-sm text-zinc-500">로딩…</div>
        ) : items.length === 0 ? (
          <div className="px-3 py-2 text-sm text-zinc-500">결과 없음</div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="w-12 shrink-0 font-mono text-[11px] text-zinc-500">
                  {it.id}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">
                    {it.itemName}
                    {it.itemKind === "material" && it.quantity > 1 ? (
                      <span className="ml-1 text-zinc-500">
                        ×{it.quantity}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {it.sellerName}
                    {" · "}
                    {it.itemKind === "equip" ? "장비" : "재료"}
                    {" · "}
                    <StatusBadge status={it.status} />
                    {" · "}
                    {formatTime(it.createdAt)}
                    {it.buyerId ? ` · 구매자 ${it.buyerId.slice(0, 8)}…` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-amber-700 dark:text-amber-400">
                  {it.price.toLocaleString()} G
                </span>
                <span className="shrink-0">
                  {it.status === "active" ? (
                    <Button
                      variant="danger"
                      disabled={readOnly}
                      onClick={() => forceCancel(it)}
                    >
                      강제 취소
                    </Button>
                  ) : (
                    <span className="text-[11px] text-zinc-500">—</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {nextCursor ? (
          <div className="border-t border-zinc-200 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800">
            결과가 더 있습니다 — 검색어/필터를 좁혀 주세요. (cursor 페이징은
            v1 미적용)
          </div>
        ) : null}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === "active"
      ? "text-emerald-600 dark:text-emerald-400"
      : status === "sold"
        ? "text-blue-600 dark:text-blue-400"
        : "text-zinc-500";
  const label =
    status === "active" ? "활성" : status === "sold" ? "판매됨" : "취소됨";
  return <span className={cls}>{label}</span>;
}
