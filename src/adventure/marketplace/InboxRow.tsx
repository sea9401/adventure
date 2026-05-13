"use client";

import { Card } from "@/components/ui/Card";
import type { InboxItem } from "./api";
import { summarizePayload } from "./summarizePayload";

export function InboxRow({
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
