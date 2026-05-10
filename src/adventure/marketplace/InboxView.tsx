"use client";

import { useCallback, useEffect, useState } from "react";
import { Envelope, PaperPlaneTilt } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { ITEMS, type ItemId } from "@/adventure/data/items";
import { MATERIALS, type MaterialId } from "@/adventure/data/materials";
import { getRecipeById } from "@/adventure/data/recipes";
import { useGame } from "@/adventure/GameContext";
import {
  acceptGuildInvite,
  declineGuildInvite,
  GuildError,
} from "@/adventure/guild/api";
import { claimInbox, fetchInbox, type InboxItem } from "./api";
import { SendMessageModal } from "./SendMessageModal";

export function InboxView() {
  const {
    remote,
    inventory,
    characterStateHook,
    crafting,
    inbox,
    addNotification,
    grantTitle,
  } = useGame();
  const addEquipment = inventory.addEquipment;
  const addMaterial = inventory.addMaterial;
  const addGold = characterStateHook.addGold;
  // 거래/우편으로 받은 제작서는 공유 토큰 없이 학습.
  const learnRecipeFromTrade = crafting.learnRecipeFromTrade;
  const refreshInbox = inbox.refresh;
  const pushToast = (msg: string) => addNotification("info", msg);

  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ recipient: string } | null>(null);

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

  // 길드 초대 수락/거절 — claim 흐름과 별개. 응답 후 우편 목록만 새로고침.
  const respondToGuildInvite = async (
    inviteId: number,
    inboxRowId: number,
    accept: boolean,
  ) => {
    setError(null);
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.add(inboxRowId);
      return next;
    });
    try {
      if (accept) {
        const r = await acceptGuildInvite(inviteId);
        characterStateHook.setAffiliation(r.guildName);
        grantTitle("guild_member");
        pushToast(`${r.guildName} 길드에 가입했습니다.`);
      } else {
        await declineGuildInvite(inviteId);
        pushToast("초대를 거절했습니다.");
      }
      void load();
      refreshInbox();
    } catch (e) {
      const msg =
        e instanceof GuildError
          ? e.message
          : e instanceof Error
            ? e.message
            : "처리 실패";
      setError(msg);
      pushToast(msg);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(inboxRowId);
        return next;
      });
    }
  };

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
      // 거래/우편 출처 학습 — 새로 받은 것만 known 에 추가. 토큰 부여는 X
      // (재거래 사이클로 토큰을 영구 갱신하지 못하도록).
      // skipped (이미 알던 것) 는 무시 — 받은 사람 입장에서 바뀌는 것 없음.
      for (const id of r.recipesAdded) learnRecipeFromTrade(id);
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
      for (const id of r.recipesAdded) {
        const name = getRecipeById(id)?.name ?? id;
        parts.push(`📜 ${name}`);
      }
      if (parts.length > 0) {
        pushToast(`수령 완료 — ${parts.join(", ")}`);
      } else if (r.recipesSkipped.length > 0) {
        pushToast("이미 알고 있는 제작서입니다.");
      } else {
        pushToast("수령 완료");
      }
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

  const pager = usePagination(items, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          거래 결과와 다른 모험가의 쪽지가 도착합니다.
        </p>
        <button
          type="button"
          onClick={() => setComposer({ recipient: "" })}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <PaperPlaneTilt size={14} weight="fill" />
          쪽지 보내기
        </button>
      </div>

      {error ? (
        <Card padding="sm">
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        </Card>
      ) : null}

      {(() => {
        // 전체 수령 — 길드 초대는 별도 흐름이라 제외.
        const claimable = items.filter((i) => i.kind !== "guild_invite");
        if (claimable.length <= 1) return null;
        return (
          <Card padding="sm">
            <button
              type="button"
              disabled={busyIds.size > 0 || loading}
              onClick={() => claim(claimable.map((i) => i.id))}
              className="w-full rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              전체 수령 ({claimable.length}건)
            </button>
          </Card>
        );
      })()}

      {loading && items.length === 0 ? (
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="rounded-lg border border-zinc-200 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/60"
            >
              <Skeleton rows={2} />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Envelope size={40} weight="duotone" />}
          title="수령할 우편이 없습니다"
          message="거래 결과나 다른 모험가의 쪽지가 여기에 도착합니다."
        />
      ) : (
        <div className="space-y-2">
          {pager.pageItems.map((it) => {
            const inviteId =
              it.kind === "guild_invite"
                ? Number((it.payload as { invite_id?: unknown }).invite_id)
                : null;
            return (
              <InboxRow
                key={it.id}
                item={it}
                busy={busyIds.has(it.id)}
                onClaim={() => claim([it.id])}
                onReply={
                  it.kind === "user_message" && it.fromName
                    ? () => setComposer({ recipient: it.fromName as string })
                    : undefined
                }
                onAccept={
                  inviteId !== null && Number.isInteger(inviteId)
                    ? () => respondToGuildInvite(inviteId, it.id, true)
                    : undefined
                }
                onDecline={
                  inviteId !== null && Number.isInteger(inviteId)
                    ? () => respondToGuildInvite(inviteId, it.id, false)
                    : undefined
                }
              />
            );
          })}
          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            setPage={pager.setPage}
          />
        </div>
      )}

      {composer && (
        <SendMessageModal
          initialRecipient={composer.recipient}
          onClose={() => setComposer(null)}
          onSent={(name) => pushToast(`${name} 에게 쪽지를 보냈습니다.`)}
        />
      )}
    </div>
  );
}

function InboxRow({
  item,
  busy,
  onClaim,
  onReply,
  onAccept,
  onDecline,
}: {
  item: InboxItem;
  busy: boolean;
  onClaim: () => void;
  onReply?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const isMessage = item.kind === "user_message";
  const isGuildInvite = item.kind === "guild_invite" && !!onAccept && !!onDecline;
  const summary = summarizePayload(item);
  const messageText =
    isMessage && typeof (item.payload as { text?: unknown }).text === "string"
      ? ((item.payload as { text: string }).text)
      : null;

  return (
    <Card padding="sm">
      <div className="flex items-start gap-3">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {summary}
          </span>
          {messageText ? (
            <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-300">
              {messageText}
            </span>
          ) : null}
          {!isMessage && item.message ? (
            <span className="block text-xs text-zinc-500">{item.message}</span>
          ) : null}
        </span>
        <div className="flex shrink-0 flex-col items-stretch gap-1">
          {isGuildInvite ? (
            <>
              <button
                type="button"
                onClick={onAccept}
                disabled={busy}
                className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "처리 중…" : "수락"}
              </button>
              <button
                type="button"
                onClick={onDecline}
                disabled={busy}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                거절
              </button>
            </>
          ) : (
            <>
              {onReply ? (
                <button
                  type="button"
                  onClick={onReply}
                  disabled={busy}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  답장
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={onClaim}
                className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "처리 중…" : isMessage ? "확인" : "수령"}
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function summarizePayload(item: InboxItem): string {
  const p = item.payload;
  if (item.kind === "user_message") {
    const from = item.fromName ?? "알 수 없는 발신자";
    return `✉️ ${from} 의 쪽지`;
  }
  if (item.kind === "sale_proceeds") {
    const g = Number((p as { gold?: unknown }).gold ?? 0);
    return `🪙 판매 대금 ${g.toLocaleString()} G`;
  }
  if (item.kind === "recipe_gift") {
    const id = (p as { recipe_id?: unknown }).recipe_id;
    const name =
      typeof id === "string" ? (getRecipeById(id)?.name ?? id) : "제작서";
    const from = item.fromName ?? "알 수 없는 발신자";
    return `📜 ${from} 의 제작서 선물 — ${name}`;
  }
  if (item.kind === "listing_expired") {
    const kind = (p as { item_kind?: unknown }).item_kind;
    const id = (p as { item_id?: unknown }).item_id;
    const qty = Number((p as { quantity?: unknown }).quantity ?? 0);
    let name = typeof id === "string" ? id : "?";
    if (kind === "recipe" && typeof id === "string") {
      name = getRecipeById(id)?.name ?? id;
    } else if (kind === "equip" && typeof id === "string") {
      name = ITEMS[id as ItemId]?.name ?? id;
    } else if (kind === "material" && typeof id === "string") {
      name = MATERIALS[id as MaterialId]?.name ?? id;
    }
    return `⏰ 매물 회수 — ${name}${qty > 1 ? ` ×${qty}` : ""}`;
  }
  if (item.kind === "guild_invite") {
    const guildName =
      typeof (p as { guild_name?: unknown }).guild_name === "string"
        ? (p as { guild_name: string }).guild_name
        : "?";
    const from = item.fromName ?? "알 수 없는 발신자";
    return `🤝 ${from} 의 길드 초대 — ${guildName}`;
  }
  if (item.kind === "guild_quest_reward") {
    const name =
      typeof (p as { quest_name?: unknown }).quest_name === "string"
        ? (p as { quest_name: string }).quest_name
        : "길드 의뢰";
    const g = Number((p as { gold?: unknown }).gold ?? 0);
    return `🏆 길드 의뢰 보상 — ${name}${g > 0 ? ` (+${g.toLocaleString()} G)` : ""}`;
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
    } else if (kind === "recipe" && typeof id === "string") {
      name = getRecipeById(id)?.name ?? id;
    }
    const prefix =
      item.kind === "purchase_item"
        ? kind === "recipe"
          ? "📜 구매한 제작서"
          : "🎁 구매한 아이템"
        : "↩️ 환불";
    return `${prefix} — ${name}${qty > 1 ? ` ×${qty}` : ""}`;
  }
  return "(알 수 없는 우편)";
}
