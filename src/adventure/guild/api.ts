// 길드 시스템 클라이언트 API. fetch wrapper — 에러 메시지를 한국어로 변환.

export type GuildMember = {
  userId: string;
  name: string;
  role: "master" | "member";
  level: number | null;
  title: string | null;
  lastSeenAt: string | null;
  joinedAt: string;
};

export type GuildInfo = {
  id: number;
  name: string;
  masterId: string;
  createdAt: string;
  members: GuildMember[];
};

export type GuildMeResponse = {
  guild: GuildInfo | null;
  leaveCooldownUntil: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "로그인이 필요합니다.",
  already_in_guild: "이미 다른 길드에 소속돼 있습니다.",
  cooldown: "탈퇴/추방 쿨다운 중입니다.",
  name_taken: "이미 사용 중인 길드명입니다.",
  name_invalid: "사용할 수 없는 길드명입니다.",
  no_character: "캐릭터 정보를 먼저 만들어 주세요.",
  requirements: "길드 생성 조건을 만족하지 않습니다.",
  insufficient_gold: "200G가 필요합니다.",
  guild_not_found: "길드를 찾을 수 없습니다.",
  guild_disbanded: "이미 해체된 길드입니다.",
  not_master: "마스터만 가능합니다.",
  not_member: "이 길드의 멤버가 아닙니다.",
  master_must_transfer: "양도 후에 탈퇴할 수 있습니다.",
  cannot_kick_self: "자기 자신은 추방할 수 없습니다.",
  self_invite: "자기 자신을 초대할 수 없습니다.",
  self_transfer: "자기 자신에게 양도할 수 없습니다.",
  target_not_found: "대상 유저를 찾을 수 없습니다.",
  target_in_guild: "대상이 이미 다른 길드에 속해 있습니다.",
  target_cooldown: "대상이 탈퇴 쿨다운 중입니다.",
  target_not_member: "이 길드의 멤버가 아닙니다.",
  already_invited: "이미 초대장을 보낸 상대입니다.",
  guild_full: "길드 정원이 가득 찼습니다.",
  invite_not_found: "초대장을 찾을 수 없습니다.",
  invite_not_pending: "이미 처리된 초대장입니다.",
  invite_expired: "만료된 초대장입니다.",
  not_recipient: "본인의 초대장이 아닙니다.",
};

export class GuildError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message?: string) {
    super(message ?? ERROR_MESSAGES[code] ?? code);
    this.code = code;
    this.status = status;
  }
}

async function parseError(r: Response): Promise<GuildError> {
  let code = "unknown";
  let message: string | undefined;
  try {
    const body = await r.json();
    if (typeof body?.error === "string") code = body.error;
    if (typeof body?.message === "string") message = body.message;
  } catch {}
  return new GuildError(code, r.status, message);
}

export async function fetchMyGuild(): Promise<GuildMeResponse> {
  const r = await fetch("/api/guilds/me");
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as GuildMeResponse;
}

export async function createGuild(
  name: string,
): Promise<{ ok: true; guildId: number; name: string; newGold: number }> {
  const r = await fetch("/api/guilds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as {
    ok: true;
    guildId: number;
    name: string;
    newGold: number;
  };
}

export async function inviteToGuild(
  guildId: number,
  name: string,
): Promise<{ ok: true; inviteId: number; targetName: string }> {
  const r = await fetch(`/api/guilds/${guildId}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as {
    ok: true;
    inviteId: number;
    targetName: string;
  };
}

export async function acceptGuildInvite(
  inviteId: number,
): Promise<{ ok: true; guildId: number; guildName: string }> {
  const r = await fetch(`/api/guilds/invites/${inviteId}/accept`, {
    method: "POST",
  });
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as { ok: true; guildId: number; guildName: string };
}

export async function declineGuildInvite(
  inviteId: number,
): Promise<{ ok: true }> {
  const r = await fetch(`/api/guilds/invites/${inviteId}/decline`, {
    method: "POST",
  });
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as { ok: true };
}

export async function leaveGuild(
  guildId: number,
): Promise<{ ok: true; disbanded: boolean }> {
  const r = await fetch(`/api/guilds/${guildId}/leave`, { method: "POST" });
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as { ok: true; disbanded: boolean };
}

export async function kickFromGuild(
  guildId: number,
  userId: string,
): Promise<{ ok: true }> {
  const r = await fetch(`/api/guilds/${guildId}/kick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as { ok: true };
}

export async function transferMaster(
  guildId: number,
  newMasterId: string,
): Promise<{ ok: true }> {
  const r = await fetch(`/api/guilds/${guildId}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: newMasterId }),
  });
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as { ok: true };
}

export async function disbandGuild(
  guildId: number,
): Promise<{ ok: true }> {
  const r = await fetch(`/api/guilds/${guildId}/disband`, { method: "POST" });
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as { ok: true };
}

// ───── 길드 의뢰 (Phase A) ─────

export type GuildQuestInstanceShape = {
  id: number;
  questDefId: string;
  grade: string;
  status: "proposed" | "active" | "completed" | "dismissed" | "expired";
  progress: number;
  target: number;
  activatedAt: string | null;
  completedAt: string | null;
};

export type GuildQuestsThisWeekResponse = {
  guild: {
    id: number;
    name: string;
    masterId: string;
    fameTotal: number;
    fameAvailable: number;
    grade: string;
    isMaster: boolean;
  } | null;
  weekStart: string | null;
  active: GuildQuestInstanceShape | null;
  proposed: GuildQuestInstanceShape[];
};

export async function fetchThisWeekGuildQuests(): Promise<GuildQuestsThisWeekResponse> {
  const r = await fetch("/api/guilds/quests/this-week");
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as GuildQuestsThisWeekResponse;
}

export async function acceptGuildQuest(
  instanceId: number,
): Promise<{ ok: true }> {
  const r = await fetch(`/api/guilds/quests/${instanceId}/accept`, {
    method: "POST",
  });
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as { ok: true };
}

// 멤버의 활동을 활성 의뢰 카운터에 반영. 활성 의뢰가 없거나 task 와 안 맞으면
// silent ignore 라 호출자는 거의 신경 안 써도 됨 — 응답의 matched 로 판단.
export type ProgressReportBody =
  | { kind: "kill_monster"; name: string; count: number }
  | { kind: "kill_boss"; name: string; count: number }
  | { kind: "collect_material"; materialId: string; count: number };

export type ProgressReportResponse = {
  ok: true;
  matched: boolean;
  reason?: string;
  progress?: number;
  target?: number;
  completed?: boolean;
  fameAdded?: number;
};

export async function reportGuildQuestProgress(
  body: ProgressReportBody,
): Promise<ProgressReportResponse> {
  const r = await fetch("/api/guilds/quests/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw await parseError(r);
  return (await r.json()) as ProgressReportResponse;
}
