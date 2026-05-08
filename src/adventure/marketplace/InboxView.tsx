"use client";

import { useCallback, useEffect, useState } from "react";
import { Envelope } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ITEMS, type ItemId } from "@/adventure/data/items";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import type { RemoteSave } from "@/lib/storage/remote";
import { claimInbox, fetchInbox, type InboxItem } from "./api";

export function InboxView({
  remote,
  addEquipment,
  addMaterial,
  addGold,
  refreshInbox,
  pushToast,
}: {
  remote: RemoteSave;
  addEquipment: (id: ItemId, n?: number) => void;
  addMaterial: (id: MaterialId, n?: number) => void;
  addGold: (delta: number) => void;
  refreshInbox: () => void;
  pushToast: (msg: string) => void;
}) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchInbox();
      setItems(r.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "우편함 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const claim = async (ids: number[]) => {
    if (ids.length === 0) return;
    setError(null);
    setBusyIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    try {
      const r = await claimInbox(remote, ids);
      // 서버 응답 기반으로 로컬 골드/인벤 반영. (race window 최소화)
      if (r.goldAdded > 0) addGold(r.goldAdded);
      for (const it of r.itemsAdded) {
        if (it.kind === "equip") {
          if (Object.prototype.hasOwnProperty.call(ITEMS, it.id)) {
            addEquipment(it.id as ItemId, it.quantity);
          }
        } else {
          if (Object.prototype.hasOwnProperty.call(MATERIALS, it.id)) {
            addMaterial(it.id as MaterialId, it.quantity);
          }
        }
      }
      // 토스트 — 합산 표시.
      const parts: string[] = [];
      if (r.goldAdded > 0) parts.push(`🪙 ${r.goldAdded.toLocaleString()} G`);
      const grouped = new Map<string, number>();
      for (const it of r.itemsAdded) {
        const name =
          it.kind === "equip"
            ? ITEMS[it.id as ItemId]?.name
            : MATERIALS[it.id as MaterialId]?.name;
        const label = name ?? it.id;
        grouped.set(label, (grouped.get(label) ?? 0) + it.quantity);
      }
      for (const [name, qty] of grouped) {
        parts.push(`${name}${qty > 1 ? ` ×${qty}` : ""}`);
      }
      pushToast(`수령 완료 — ${parts.join(", ") || "내용 없음"}`);
      // 목록 새로고침 + 헤더 카운트 갱신.
      void load();
      refreshInbox();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "수령 실패";
      setError(msg);
      pushToast(msg);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      {error ? (
        <Card padding="sm">
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        </Card>
      ) : null}

      {items.length > 1 ? (
        <Card padding="sm">
          <button
            type="button"
            disabled={busyIds.size > 0 || loading}
            onClick={() => claim(items.map((i) => i.id))}
            className="w-full rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            전체 수령 ({items.length}건)
          </button>
        </Card>
      ) : null}

      {loading && items.length === 0 ? (
        <Card padding="md">
          <div className="text-sm text-zinc-500">로딩…</div>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Envelope size={40} weight="duotone" />}
          title="수령할 우편이 없습니다"
          message="거래소에서 거래가 성사되면 여기에 도착합니다."
        />
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <InboxRow
              key={it.id}
              item={it}
              busy={busyIds.has(it.id)}
              onClaim={() => claim([it.id])}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InboxRow({
  item,
  busy,
  onClaim,
}: {
  item: InboxItem;
  busy: boolean;
  onClaim: () => void;
}) {
  const summary = summarizePayload(item);
  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {summary}
          </span>
          {item.message ? (
            <span className="block text-xs text-zinc-500">{item.message}</span>
          ) : null}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onClaim}
          className="shrink-0 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "수령 중…" : "수령"}
        </button>
      </div>
    </Card>
  );
}

function summarizePayload(item: InboxItem): string {
  const p = item.payload;
  if (item.kind === "sale_proceeds") {
    const g = Number((p as { gold?: unknown }).gold ?? 0);
    return `🪙 판매 대금 ${g.toLocaleString()} G`;
  }
  if (item.kind === "purchase_item" || item.kind === "cancel_return") {
    const kind = (p as { item_kind?: unknown }).item_kind;
    const id = (p as { item_id?: unknown }).item_id;
    const qty = Number((p as { quantity?: unknown }).quantity ?? 1);
    let name = typeof id === "string" ? id : "?";
    if (kind === "equip" && typeof id === "string") {
      name = ITEMS[id as ItemId]?.name ?? id;
    } else if (kind === "material" && typeof id === "string") {
      name = MATERIALS[id as MaterialId]?.name ?? id;
    }
    const prefix = item.kind === "purchase_item" ? "🎁 구매한 아이템" : "↩️ 환불";
    return `${prefix} — ${name}${qty > 1 ? ` ×${qty}` : ""}`;
  }
  return "(알 수 없는 우편)";
}
