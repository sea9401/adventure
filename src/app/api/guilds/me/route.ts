import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  guildLeaveCooldown,
  guildMembers,
  guilds,
  presence,
  savesKv,
  users,
} from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { SAVES_CHARACTER } from "@/lib/server/guildAffiliation";

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

  const memberRows = await db
    .select({
      userId: guildMembers.userId,
      role: guildMembers.role,
      joinedAt: guildMembers.joinedAt,
      name: users.name,
      lastSeenAt: presence.lastSeenAt,
      title: presence.title,
    })
    .from(guildMembers)
    .leftJoin(users, eq(users.id, guildMembers.userId))
    .leftJoin(presence, eq(presence.userId, guildMembers.userId))
    .where(eq(guildMembers.guildId, guildId));

  const memberUserIds = memberRows.map((r) => r.userId);
  const charRows = memberUserIds.length
    ? await db
        .select({ userId: savesKv.userId, value: savesKv.value })
        .from(savesKv)
        .where(
          and(
            eq(savesKv.key, SAVES_CHARACTER),
            inArray(savesKv.userId, memberUserIds),
          ),
        )
    : [];
  const levelByUserId = new Map<string, number>();
  for (const r of charRows) {
    const level = Number((r.value as { level?: unknown }).level ?? 1);
    levelByUserId.set(r.userId, Number.isFinite(level) ? level : 1);
  }

  const members = memberRows.map((r) => ({
    userId: r.userId,
    name: r.name ?? "(이름 미설정)",
    role: r.role,
    level: levelByUserId.get(r.userId) ?? null,
    title: r.title,
    lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
    joinedAt: r.joinedAt.toISOString(),
  }));

  return Response.json({
    guild: {
      id: guild.id,
      name: guild.name,
      masterId: guild.masterId,
      createdAt: guild.createdAt.toISOString(),
      members,
    },
    leaveCooldownUntil,
  });
}
