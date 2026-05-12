"use client";

import { useEffect, useState } from "react";
import { UsersThree } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  GUILD_CREATE_GOLD,
  GUILD_CREATE_LEVEL,
  GUILD_CREATE_QUEST_COUNT,
  GUILD_MAX_MEMBERS,
  GUILD_NAME_MAX,
  GUILD_NAME_MIN,
  validateGuildName,
} from "@/adventure/data/guild";
import { formatClock, formatRelative } from "./guildFormat";

export function GuildNoGuildPanel({
  showCreate,
  onShowCreate,
  onCancelCreate,
  onCreate,
  busy,
  characterLevel,
  characterGold,
  leaveCooldownUntil,
}: {
  showCreate: boolean;
  onShowCreate: () => void;
  onCancelCreate: () => void;
  onCreate: (name: string) => void;
  busy: boolean;
  characterLevel: number;
  characterGold: number;
  leaveCooldownUntil: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  const cooldownUntilDate = leaveCooldownUntil
    ? new Date(leaveCooldownUntil)
    : null;
  const cooldownActive =
    cooldownUntilDate !== null && cooldownUntilDate.getTime() > now;
  // 쿨다운 중일 때만 분 단위로 갱신 — "N시간 후" 표기가 멈춰 보이지 않게.
  useEffect(() => {
    if (!cooldownActive) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [cooldownActive]);
  const meetsLevel = characterLevel >= GUILD_CREATE_LEVEL;
  const meetsGold = characterGold >= GUILD_CREATE_GOLD;

  return (
    <Card padding="md">
      <div className="space-y-3">
        <EmptyState
          icon={<UsersThree size={40} weight="duotone" />}
          title="아직 소속된 길드가 없습니다"
          message="새 길드를 만들거나, 받은 초대장이 있다면 우편함에서 확인할 수 있습니다."
        />

        {cooldownActive ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            길드 탈퇴/추방 쿨다운 중 —{" "}
            <span className="font-semibold">
              {formatRelative(cooldownUntilDate!)}
            </span>{" "}
            새 길드 가입·생성 가능 ({formatClock(cooldownUntilDate!)})
          </div>
        ) : null}

        {!showCreate ? (
          <button
            type="button"
            disabled={busy || !!cooldownActive}
            onClick={onShowCreate}
            className="block w-full rounded-md border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            + 새 길드 만들기
          </button>
        ) : (
          <CreateForm onCancel={onCancelCreate} onSubmit={onCreate} busy={busy} />
        )}

        <div className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <p className="font-medium">길드 생성 조건</p>
          <ul className="mt-1 space-y-0.5">
            <li>
              레벨 {GUILD_CREATE_LEVEL} 이상{" "}
              <span
                className={
                  meetsLevel ? "text-emerald-600 dark:text-emerald-400" : ""
                }
              >
                ({characterLevel})
              </span>{" "}
              또는 서로 다른 의뢰 {GUILD_CREATE_QUEST_COUNT}종 완료
            </li>
            <li>
              {GUILD_CREATE_GOLD} G{" "}
              <span
                className={
                  meetsGold
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }
              >
                (보유 {characterGold})
              </span>
            </li>
            <li>
              정원 {GUILD_MAX_MEMBERS}명 — 마스터가 우편으로 초대장을 보내서
              채웁니다.
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function CreateForm({
  onCancel,
  onSubmit,
  busy,
}: {
  onCancel: () => void;
  onSubmit: (name: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const validation = validateGuildName(name || " ");
  const helper =
    name.length === 0
      ? `${GUILD_NAME_MIN}~${GUILD_NAME_MAX}자, 한글/영문/숫자/공백`
      : validation.ok
        ? null
        : validation.reason;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!validation.ok) return;
        onSubmit(validation.trimmed);
      }}
      className="space-y-2"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={GUILD_NAME_MAX + 4}
        placeholder="길드명"
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        autoFocus
      />
      {helper ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{helper}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !validation.ok}
          className="flex-1 rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "처리 중…" : `만들기 (-${GUILD_CREATE_GOLD} G)`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          취소
        </button>
      </div>
    </form>
  );
}
