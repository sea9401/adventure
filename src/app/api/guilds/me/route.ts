import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  guildJoinRequests,
  guildLeaveCooldown,
  guildMembers,
  guilds,
  presence,
  savesKv,
  users,
} from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { SAVES_CHARACTER } from "@/lib/server/guildAffiliation";
import { gradeForFame } from "@/adventure/data/guildQuests";
import { buffSlotsForGrade } from "@/adventure/data/guildBuffs";
import { pruneStaleGuildBuffs } from "@/lib/server/guildBuffs";

// 내 길드 정보 + 멤버 목록 + 탈퇴 쿨다운 상태.
// 소속 없으면 guild=null. 마지막 접속/레벨/칭호는 best-effort (없으면 null).
export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const cooldownRows = await db
    .select({ cooldownUntil: guildLeaveCooldown.cooldownUntil })
    .from(guildLeaveCooldown)
    .where(eq(guildLeaveCooldown.userId, userId))
    .limit(1);
  const now = new Date();
  const leaveCooldownUntil =
    cooldownRows[0] && cooldownRows[0].cooldownUntil > now
      ? cooldownRows[0].cooldownUntil.toISOString()
      : null;

  const myMembership = await db
    .select({ guildId: guildMembers.guildId })
    .from(guildMembers)
    .where(eq(guildMembers.userId, userId))
    .limit(1);

  if (myMembership.length === 0) {
    return Response.json({ guild: null, leaveCooldownUntil });
  }
  const { guildId } = myMembership[0];

  const guildRows = await db
    .select()
    .from(guilds)
    .where(and(eq(guilds.id, guildId), isNull(guilds.disbandedAt)))
    .limit(1);
  if (guildRows.length === 0) {
    return Response.json({ guild: null, leaveCooldownUntil });
  }
  const guild = guildRows[0];
  const isMaster = guild.masterId === userId;

  const memberRows = await db
    .select({
      userId: guildMembers.userId,
      role: guildMembers.role,
      joinedAt: guildMembers.joinedAt,
      name: users.gameName,
      presenceName: presence.name,
      lastSeenAt: presence.lastSeenAt,
      title: presence.title,
    })
    .from(guildMembers)
    .leftJoin(users, eq(users.id, guildMembers.userId))
    .leftJoin(presence, eq(presence.userId, guildMembers.userId))
    .where(eq(guildMembers.guildId, guildId));

  // 가입 신청 대기 목록 — 마스터에게만 노출.
  const requestRows = isMaster
    ? await db
        .select({
          id: guildJoinRequests.id,
          userId: guildJoinRequests.userId,
          createdAt: guildJoinRequests.createdAt,
          name: users.gameName,
          presenceName: presence.name,
        })
        .from(guildJoinRequests)
        .leftJoin(users, eq(users.id, guildJoinRequests.userId))
        .leftJoin(presence, eq(presence.userId, guildJoinRequests.userId))
        .where(
          and(
            eq(guildJoinRequests.guildId, guildId),
            eq(guildJoinRequests.status, "pending"),
          ),
        )
        .orderBy(guildJoinRequests.createdAt)
    : [];

  // savesKv 한 번에 character.v2 + character-profile.v2 둘 다 가져옴 — 레벨 + 이름 fallback.
  const lookupUserIds = [
    ...new Set([
      ...memberRows.map((r) => r.userId),
      ...requestRows.map((r) => r.userId),
    ]),
  ];
  const kvRows = lookupUserIds.length
    ? await db
        .select({
          userId: savesKv.userId,
          key: savesKv.key,
          value: savesKv.value,
        })
        .from(savesKv)
        .where(
          and(
            inArray(savesKv.key, [SAVES_CHARACTER, "character-profile.v2"]),
            inArray(savesKv.userId, lookupUserIds),
          ),
        )
    : [];
  const levelByUserId = new Map<string, number>();
  const profileNameByUserId = new Map<string, string>();
  for (const r of kvRows) {
    if (r.key === SAVES_CHARACTER) {
      const level = Number((r.value as { level?: unknown }).level ?? 1);
      levelByUserId.set(r.userId, Number.isFinite(level) ? level : 1);
    } else if (r.key === "character-profile.v2") {
      const n = (r.value as { name?: unknown }).name;
      if (typeof n === "string" && n.length > 0) {
        profileNameByUserId.set(r.userId, n);
      }
    }
  }
  const nameOf = (
    uid: string,
    gameName: string | null,
    presenceName: string | null,
  ) =>
    gameName ??
    presenceName ??
    profileNameByUserId.get(uid) ??
    "(이름 미설정)";

  // 이름 fallback: users.gameName → presence.name → character-profile.v2.name → "(이름 미설정)".
  // 레거시 유저는 users.gameName 이 NULL 일 수 있어 보강.
  const members = memberRows.map((r) => ({
    userId: r.userId,
    name: nameOf(r.userId, r.name, r.presenceName),
    role: r.role,
    level: levelByUserId.get(r.userId) ?? null,
    title: r.title,
    lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
    joinedAt: r.joinedAt.toISOString(),
  }));
  const pendingRequests = requestRows.map((r) => ({
    requestId: r.id,
    userId: r.userId,
    name: nameOf(r.userId, r.name, r.presenceName),
    level: levelByUserId.get(r.userId) ?? null,
    requestedAt: r.createdAt.toISOString(),
  }));

  // 카탈로그에서 사라진 버프(gold_boost 등) 슬롯은 자동 해제 + 50% 환급 후 반영.
  const { buffs, fameAvailable } = await pruneStaleGuildBuffs({
    id: guild.id,
    buffs: guild.buffs ?? [],
    fameAvailable: guild.fameAvailable,
  });
  const grade = gradeForFame(guild.fameTotal);
  return Response.json({
    guild: {
      id: guild.id,
      name: guild.name,
      masterId: guild.masterId,
      createdAt: guild.createdAt.toISOString(),
      description: guild.description ?? null,
      fameTotal: guild.fameTotal,
      fameAvailable,
      grade,
      isMaster,
      acceptingRequests: guild.acceptingRequests,
      members,
      pendingRequests,
      buffs,
      maxBuffSlots: buffSlotsForGrade(grade),
    },
    leaveCooldownUntil,
  });
}
