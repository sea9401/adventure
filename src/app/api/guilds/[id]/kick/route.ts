import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { guildLeaveCooldown, guildMembers, guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { clearAffiliationInTx } from "@/lib/server/guildAffiliation";
import { GUILD_LEAVE_COOLDOWN_DAYS } from "@/adventure/data/guild";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const { id: idStr } = await params;
  const guildId = Number(idStr);
  if (!Number.isInteger(guildId) || guildId <= 0) {
    return new Response("invalid id", { status: 400 });
  }

  let body: { userId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (typeof body.userId !== "string" || body.userId.length === 0) {
    return new Response("userId required", { status: 400 });
  }
  const targetUserId = body.userId;

  if (targetUserId === userId) {
    return Response.json({ error: "cannot_kick_self" }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const guildRows = await tx
        .select()
        .from(guilds)
        .where(and(eq(guilds.id, guildId), isNull(guilds.disbandedAt)))
        .limit(1);
      const guild = guildRows[0];
      if (!guild) {
        return { error: "guild_not_found", status: 404 as const };
      }
      if (guild.masterId !== userId) {
        return { error: "not_master", status: 403 as const };
      }

      const targetRows = await tx
        .select()
        .from(guildMembers)
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, targetUserId),
          ),
        )
        .limit(1);
      if (targetRows.length === 0) {
        return { error: "target_not_member", status: 404 as const };
      }

      await tx
        .delete(guildMembers)
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, targetUserId),
          ),
        );

      await clearAffiliationInTx(tx, targetUserId);

      const cooldownUntil = new Date(
        Date.now() + GUILD_LEAVE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
      );
      await tx
        .insert(guildLeaveCooldown)
        .values({ userId: targetUserId, cooldownUntil })
        .onConflictDoUpdate({
          target: guildLeaveCooldown.userId,
          set: { cooldownUntil },
        });

      return { ok: true as const };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.kick.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
