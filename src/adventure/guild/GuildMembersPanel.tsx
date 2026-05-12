"use client";

import { Crown, UserMinus } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import type { GuildInfo } from "./api";
import { formatRelative } from "./guildFormat";

export function GuildMembersPanel({
  guild,
  busy,
  onLeave,
  onKick,
  onTransfer,
}: {
  guild: GuildInfo;
  busy: boolean;
  onLeave: () => void;
  onKick: (userId: string, name: string) => void;
  onTransfer: (userId: string, name: string) => void;
}) {
  // 멤버 양도/추방의 row 인라인 버튼은 마스터가 아닌 유저에게도 보이지만 — 권한 없으면
  // 서버에서 403. 마스터 전용 일괄 액션(초대/해체)은 길드 관리 탭으로 분리되어 있다.
  return (
    <Card padding="md">
      <div className="space-y-3">
        <ul className="space-y-1.5">
          {guild.members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              guildMasterId={guild.masterId}
              busy={busy}
              onKick={() => onKick(m.userId, m.name)}
              onTransfer={() => onTransfer(m.userId, m.name)}
            />
          ))}
        </ul>

        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onLeave}
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            길드 탈퇴
          </button>
        </div>
      </div>
    </Card>
  );
}

function MemberRow({
  member,
  guildMasterId,
  busy,
  onKick,
  onTransfer,
}: {
  member: GuildInfo["members"][number];
  guildMasterId: string;
  busy: boolean;
  onKick: () => void;
  onTransfer: () => void;
}) {
  const isMaster = member.role === "master";
  const showActions = !isMaster && member.userId !== guildMasterId;
  return (
    <li className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        {isMaster ? (
          <Crown
            size={14}
            weight="fill"
            className="shrink-0 text-amber-500"
            aria-label="마스터"
          />
        ) : (
          <span aria-hidden className="inline-block w-3.5" />
        )}
        <span className="truncate text-sm font-medium">{member.name}</span>
        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
          {member.level !== null ? `Lv.${member.level}` : ""}
          {member.title ? ` · ${member.title}` : ""}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {member.lastSeenAt
            ? formatRelative(new Date(member.lastSeenAt))
            : "—"}
        </span>
        {showActions ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onTransfer}
              disabled={busy}
              className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              title="마스터 양도"
            >
              <Crown size={11} weight="bold" />
            </button>
            <button
              type="button"
              onClick={onKick}
              disabled={busy}
              className="rounded-md border border-rose-300 bg-white px-2 py-0.5 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:bg-zinc-900 dark:text-rose-300"
              title="추방"
            >
              <UserMinus size={11} weight="bold" />
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
