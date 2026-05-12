"use client";

import { UserPlus } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import {
  GUILD_LEAVE_COOLDOWN_DAYS,
  GUILD_MAX_MEMBERS,
} from "@/adventure/data/guild";
import type { GuildInfo } from "./api";

// 마스터 전용 — 멤버 초대 + 길드 해체 등 일괄 운영 액션. 탭 자체가 마스터에게만 노출.
export function GuildManagePanel({
  guild,
  busy,
  onInviteClick,
  onDisband,
}: {
  guild: GuildInfo;
  busy: boolean;
  onInviteClick: () => void;
  onDisband: () => void;
}) {
  const memberCount = guild.members.length;
  const isFull = memberCount >= GUILD_MAX_MEMBERS;

  return (
    <Card padding="md">
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold">멤버 모집</h4>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {isFull
              ? `정원이 가득 찼습니다 (${memberCount}/${GUILD_MAX_MEMBERS}).`
              : `현재 ${memberCount}/${GUILD_MAX_MEMBERS} — 우편으로 초대장을 보내 모집할 수 있습니다.`}
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
