"use client";

import { Check, UserPlus, X } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import {
  GUILD_LEAVE_COOLDOWN_DAYS,
  GUILD_MAX_MEMBERS,
} from "@/adventure/data/guild";
import type { GuildInfo } from "./api";

// 마스터 전용 — 멤버 초대 / 가입 신청 처리 / 신청 받기 토글 / 길드 해체. 탭 자체가 마스터 전용.
export function GuildManagePanel({
  guild,
  busy,
  onInviteClick,
  onAcceptRequest,
  onDeclineRequest,
  onToggleAccepting,
  onDisband,
}: {
  guild: GuildInfo;
  busy: boolean;
  onInviteClick: () => void;
  onAcceptRequest: (requestId: number, name: string) => void;
  onDeclineRequest: (requestId: number, name: string) => void;
  onToggleAccepting: (next: boolean) => void;
  onDisband: () => void;
}) {
  const memberCount = guild.members.length;
  const isFull = memberCount >= GUILD_MAX_MEMBERS;
  const requests = guild.pendingRequests;

  return (
    <Card padding="md">
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold">멤버 모집</h4>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {isFull
              ? `정원이 가득 찼습니다 (${memberCount}/${GUILD_MAX_MEMBERS}).`
              : `현재 ${memberCount}/${GUILD_MAX_MEMBERS} — 우편으로 초대장을 보내거나, 둘러보기에서 들어온 가입 신청을 수락해 모집합니다.`}
          </p>
          <button
            type="button"
            onClick={onInviteClick}
            disabled={busy || isFull}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <UserPlus size={14} weight="bold" />
            멤버 초대
          </button>
        </div>

        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">가입 신청 받기</h4>
            <button
              type="button"
              role="switch"
              aria-checked={guild.acceptingRequests}
              onClick={() => onToggleAccepting(!guild.acceptingRequests)}
              disabled={busy}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                guild.acceptingRequests
                  ? "bg-emerald-600"
                  : "bg-zinc-300 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  guild.acceptingRequests ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {guild.acceptingRequests
              ? "둘러보기 목록에서 누구나 가입 신청할 수 있습니다."
              : "지금은 가입 신청을 받지 않습니다. 초대로만 모집됩니다."}
          </p>

          {requests.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {requests.map((rq) => (
                <li
                  key={rq.requestId}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {rq.name}
                    </span>
                    {rq.level != null ? (
                      <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Lv {rq.level}
                      </span>
                    ) : null}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onAcceptRequest(rq.requestId, rq.name)}
                      disabled={busy || isFull}
                      title={isFull ? "정원이 가득 찼습니다" : "수락"}
                      className="inline-flex items-center gap-0.5 rounded-md border border-emerald-700 bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check size={12} weight="bold" />
                      수락
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeclineRequest(rq.requestId, rq.name)}
                      disabled={busy}
                      className="inline-flex items-center gap-0.5 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <X size={12} weight="bold" />
                      거절
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              대기 중인 가입 신청이 없습니다.
            </p>
          )}
        </div>

        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-400">
            위험 구역
          </h4>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            해체 후 본인은 {GUILD_LEAVE_COOLDOWN_DAYS}일 쿨다운, 다른 멤버는 즉시
            무소속이 됩니다.
          </p>
          <button
            type="button"
            onClick={onDisband}
            disabled={busy}
            className="mt-2 rounded-md border border-rose-700 bg-rose-600/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            길드 해체
          </button>
        </div>
      </div>
    </Card>
  );
}
