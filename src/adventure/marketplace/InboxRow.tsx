"use client";

import { memo } from "react";
import { Card } from "@/components/ui/Card";
import type { InboxItem } from "./api";
import { summarizePayload } from "./summarizePayload";

// 부모(InboxView)가 모든 row 에 대해 하나의 안정 onAction 만 넘기도록 액션을 discriminated union 으로.
// row 별 인라인 클로저(매 렌더 새 함수)를 피해 InboxRow 의 memo 가 실제로 작동한다.
export type InboxAction =
  | { type: "claim"; id: number }
  | { type: "reply"; fromName: string }
  | {
      type: "guild_invite_respond";
      inviteId: number;
      inboxRowId: number;
      accept: boolean;
    };

type InboxRowProps = {
  item: InboxItem;
  busy: boolean;
  onAction: (action: InboxAction) => void;
};

function InboxRowImpl({ item, busy, onAction }: InboxRowProps) {
  const isMessage = item.kind === "user_message";
  // 길드 초대 payload 에서 inviteId 추출 — 정수가 아니면 일반 row 로 폴백(수락/거절 버튼 X).
  const inviteId =
    item.kind === "guild_invite"
      ? Number((item.payload as { invite_id?: unknown }).invite_id)
      : NaN;
  const isGuildInvite =
    item.kind === "guild_invite" && Number.isInteger(inviteId);
  const summary = summarizePayload(item);
  const messageText =
    isMessage && typeof (item.payload as { text?: unknown }).text === "string"
      ? ((item.payload as { text: string }).text)
      : null;
  const canReply = isMessage && !!item.fromName;

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
                onClick={() =>
                  onAction({
                    type: "guild_invite_respond",
                    inviteId,
                    inboxRowId: item.id,
                    accept: true,
                  })
                }
                disabled={busy}
                className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "처리 중…" : "수락"}
              </button>
              <button
                type="button"
                onClick={() =>
                  onAction({
                    type: "guild_invite_respond",
                    inviteId,
                    inboxRowId: item.id,
                    accept: false,
                  })
                }
                disabled={busy}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                거절
              </button>
            </>
          ) : (
            <>
              {canReply ? (
                <button
                  type="button"
                  onClick={() =>
                    onAction({ type: "reply", fromName: item.fromName as string })
                  }
                  disabled={busy}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  답장
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction({ type: "claim", id: item.id })}
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

// memo — 부모가 onAction 을 useCallback 으로 안정화하면, item/busy 가 같은 row 는 렌더 skip.
// busy 는 boolean 이라 변경되는 row 만 prop 이 달라짐.
export const InboxRow = memo(InboxRowImpl);
