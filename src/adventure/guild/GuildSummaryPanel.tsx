"use client";

import { useEffect, useState } from "react";
import { PencilSimple, UsersThree } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import {
  GUILD_DESCRIPTION_MAX,
  GUILD_MAX_MEMBERS,
} from "@/adventure/data/guild";
import type { GuildInfo } from "./api";

const GRADE_COLOR: Record<string, string> = {
  G: "text-zinc-500 dark:text-zinc-400",
  F: "text-zinc-600 dark:text-zinc-300",
  E: "text-emerald-600 dark:text-emerald-400",
  D: "text-sky-600 dark:text-sky-400",
  C: "text-blue-600 dark:text-blue-400",
  B: "text-violet-600 dark:text-violet-400",
  A: "text-amber-600 dark:text-amber-400",
  S: "text-rose-600 dark:text-rose-400",
};

export function GuildSummaryPanel({
  guild,
  busy,
  onSaveDescription,
}: {
  guild: GuildInfo;
  busy: boolean;
  onSaveDescription: (next: string) => void;
}) {
  return (
    <Card padding="md">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <UsersThree
                size={20}
                weight="duotone"
                className="text-violet-600 dark:text-violet-400"
              />
              <h3 className="truncate text-base font-semibold">{guild.name}</h3>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              누적 명성 {guild.fameTotal.toLocaleString()} · 멤버{" "}
              {guild.members.length}/{GUILD_MAX_MEMBERS}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">등급</p>
            <p
              className={`text-xl font-bold leading-tight ${GRADE_COLOR[guild.grade] ?? ""}`}
            >
              {guild.grade}
            </p>
          </div>
        </div>

        <DescriptionSection
          description={guild.description}
          isMaster={guild.isMaster}
          busy={busy}
          onSave={onSaveDescription}
        />
      </div>
    </Card>
  );
}

function DescriptionSection({
  description,
  isMaster,
  busy,
  onSave,
}: {
  description: string | null;
  isMaster: boolean;
  busy: boolean;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description ?? "");

  // 외부에서 description 이 갱신되면 draft 도 동기화 (저장 후 등).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setDraft(description ?? "");
  }, [description, editing]);

  if (editing) {
    const tooLong = draft.length > GUILD_DESCRIPTION_MAX;
    return (
      <div className="space-y-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={GUILD_DESCRIPTION_MAX + 20}
          rows={3}
          placeholder="길드 소개를 자유롭게 적어주세요."
          className="w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          autoFocus
        />
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[11px] ${
              tooLong
                ? "text-rose-600 dark:text-rose-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {draft.length}/{GUILD_DESCRIPTION_MAX}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(description ?? "");
              }}
              disabled={busy}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy || tooLong}
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
              className="rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <p
          className={`min-w-0 flex-1 whitespace-pre-wrap text-sm ${
            description
              ? "text-zinc-700 dark:text-zinc-300"
              : "italic text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {description ?? "(소개글이 아직 없습니다)"}
        </p>
        {isMaster ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            title="소개글 편집"
          >
            <PencilSimple size={11} weight="bold" />
            편집
          </button>
        ) : null}
      </div>
    </div>
  );
}
