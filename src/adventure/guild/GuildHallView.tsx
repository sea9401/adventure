"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  Gear,
  PencilSimple,
  Scroll,
  UserMinus,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGame } from "@/adventure/GameContext";
import {
  GUILD_CREATE_GOLD,
  GUILD_CREATE_LEVEL,
  GUILD_CREATE_QUEST_COUNT,
  GUILD_DESCRIPTION_MAX,
  GUILD_LEAVE_COOLDOWN_DAYS,
  GUILD_MAX_MEMBERS,
  GUILD_NAME_MAX,
  GUILD_NAME_MIN,
  validateGuildName,
} from "@/adventure/data/guild";
import {
  createGuild,
  disbandGuild,
  fetchMyGuild,
  kickFromGuild,
  leaveGuild,
  transferMaster,
  updateGuildDescription,
  GuildError,
  type GuildInfo,
  type GuildMeResponse,
} from "./api";
import { GuildInviteModal } from "./GuildInviteModal";
import { GuildQuestsPanel } from "./GuildQuestsPanel";

const NO_AFFILIATION = "무소속";

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

type Tab = "members" | "quests" | "manage";

export function GuildHallView() {
  const { character, characterStateHook, addNotification, grantTitle } = useGame();
  const setAffiliation = characterStateHook.setAffiliation;

  const [data, setData] = useState<GuildMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [tab, setTab] = useState<Tab>("members");

  const pushToast = (msg: string) => addNotification("info", msg);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMyGuild();
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleApiError = (e: unknown) => {
    const msg =
      e instanceof GuildError
        ? e.message
        : e instanceof Error
          ? e.message
          : "처리 실패";
    setError(msg);
    pushToast(msg);
  };

  const handleCreate = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await createGuild(name);
      setAffiliation(r.name);
      grantTitle("guild_founder");
      pushToast(`${r.name} 길드를 만들었습니다.`);
      setShowCreate(false);
      await load();
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!data?.guild) return;
    const confirmed = window.confirm(
      `${data.guild.name} 길드에서 정말 탈퇴하시겠습니까?\n탈퇴 후 ${GUILD_LEAVE_COOLDOWN_DAYS}일간 다른 길드에 가입할 수 없습니다.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const r = await leaveGuild(data.guild.id);
      setAffiliation(NO_AFFILIATION);
      if (r.disbanded) grantTitle("closed_shop");
      pushToast(r.disbanded ? "길드를 해체했습니다." : "길드에서 탈퇴했습니다.");
      await load();
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  };

  const handleKick = async (userId: string, name: string) => {
    if (!data?.guild) return;
    const confirmed = window.confirm(`${name} 님을 정말 추방하시겠습니까?`);
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await kickFromGuild(data.guild.id, userId);
      pushToast(`${name} 님을 추방했습니다.`);
      await load();
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async (userId: string, name: string) => {
    if (!data?.guild) return;
    const confirmed = window.confirm(
      `${name} 님에게 마스터 권한을 양도하시겠습니까?\n본인은 일반 멤버가 됩니다.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await transferMaster(data.guild.id, userId);
      pushToast(`${name} 님에게 마스터를 양도했습니다.`);
      await load();
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  };

  const handleDisband = async () => {
    if (!data?.guild) return;
    const confirmed = window.confirm(
      `${data.guild.name} 길드를 정말 해체하시겠습니까?\n해체 후 본인은 ${GUILD_LEAVE_COOLDOWN_DAYS}일 쿨다운, 다른 멤버는 즉시 무소속이 됩니다.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await disbandGuild(data.guild.id);
      setAffiliation(NO_AFFILIATION);
      grantTitle("closed_shop");
      pushToast("길드를 해체했습니다.");
      await load();
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDescription = async (next: string) => {
    if (!data?.guild) return;
    setBusy(true);
    setError(null);
    try {
      const r = await updateGuildDescription(data.guild.id, next);
      // 낙관적 갱신 — 응답 description 으로 로컬 상태 동기화.
      setData((prev) =>
        prev?.guild
          ? { ...prev, guild: { ...prev.guild, description: r.description } }
          : prev,
      );
      pushToast(r.description ? "소개글을 저장했습니다." : "소개글을 비웠습니다.");
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  };

  const onInviteSuccess = (targetName: string) => {
    pushToast(`${targetName} 님에게 초대장을 보냈습니다.`);
    setShowInvite(false);
    void load();
  };

  if (loading && !data) {
    return (
      <Card padding="md">
        <Skeleton rows={4} />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Card padding="sm">
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        </Card>
      ) : null}

      {data?.guild ? (
        <>
          <GuildSummaryPanel
            guild={data.guild}
            busy={busy}
            onSaveDescription={handleSaveDescription}
          />

          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/60">
            <TabButton
              icon={<UsersThree size={14} weight="bold" />}
              label={`길드원 목록 ${data.guild.members.length}/${GUILD_MAX_MEMBERS}`}
              active={tab === "members"}
              onClick={() => setTab("members")}
            />
            <TabButton
              icon={<Scroll size={14} weight="bold" />}
              label="길드 의뢰"
              active={tab === "quests"}
              onClick={() => setTab("quests")}
            />
            {data.guild.isMaster ? (
              <TabButton
                icon={<Gear size={14} weight="bold" />}
                label="길드 관리"
                active={tab === "manage"}
                onClick={() => setTab("manage")}
              />
            ) : null}
          </div>

          {tab === "manage" && data.guild.isMaster ? (
            <ManagePanel
              guild={data.guild}
              busy={busy}
              onInviteClick={() => setShowInvite(true)}
              onDisband={handleDisband}
            />
          ) : tab === "quests" ? (
            <GuildQuestsPanel />
          ) : (
            <MembersPanel
              guild={data.guild}
              busy={busy}
              onLeave={handleLeave}
              onKick={handleKick}
              onTransfer={handleTransfer}
            />
          )}
        </>
      ) : (
        <NoGuildPanel
          showCreate={showCreate}
          onShowCreate={() => setShowCreate(true)}
          onCancelCreate={() => setShowCreate(false)}
          onCreate={handleCreate}
          busy={busy}
          characterLevel={character.level}
          characterGold={character.gold}
          leaveCooldownUntil={data?.leaveCooldownUntil ?? null}
        />
      )}

      {showInvite && data?.guild ? (
        <GuildInviteModal
          guildId={data.guild.id}
          onClose={() => setShowInvite(false)}
          onSuccess={onInviteSuccess}
        />
      ) : null}
    </div>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
          : "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      }
    >
      {icon}
      {label}
    </button>
  );
}

function GuildSummaryPanel({
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

function NoGuildPanel({
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
  const cooldownActive =
    leaveCooldownUntil && new Date(leaveCooldownUntil) > new Date();
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
          <p className="text-center text-xs text-amber-700 dark:text-amber-400">
            탈퇴/추방 쿨다운 중 — {formatRelative(new Date(leaveCooldownUntil!))} 까지 새 길드 가입 불가.
          </p>
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
          <CreateForm
            onCancel={onCancelCreate}
            onSubmit={onCreate}
            busy={busy}
          />
        )}

        <div className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <p className="font-medium">길드 생성 조건</p>
          <ul className="mt-1 space-y-0.5">
            <li>
              레벨 {GUILD_CREATE_LEVEL} 이상{" "}
              <span className={meetsLevel ? "text-emerald-600 dark:text-emerald-400" : ""}>
                ({characterLevel})
              </span>{" "}
              또는 서로 다른 의뢰 {GUILD_CREATE_QUEST_COUNT}종 완료
            </li>
            <li>
              {GUILD_CREATE_GOLD} G{" "}
              <span className={meetsGold ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                (보유 {characterGold})
              </span>
            </li>
            <li>정원 {GUILD_MAX_MEMBERS}명 — 마스터가 우편으로 초대장을 보내서 채웁니다.</li>
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

function MembersPanel({
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

// 마스터 전용 — 멤버 초대 + 길드 해체 등 일괄 운영 액션. 탭 자체가 마스터에게만 노출.
function ManagePanel({
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

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < 86_400_000) return `${Math.floor(ahead / 3_600_000)}시간 후`;
    return `${Math.floor(ahead / 86_400_000)}일 후`;
  }
  return `${Math.floor(diff / 86_400_000)}일 전`;
}
