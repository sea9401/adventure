import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  guildLeaveCooldown,
  guildMembers,
  guilds,
  marketplaceInbox,
} from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { clearAffiliationInTx } from "@/lib/server/guildAffiliation";
import { GUILD_LEAVE_COOLDOWN_DAYS } from "@/adventure/data/guild";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const { id: idStr } = await params;
  const guildId = Number(idStr);
  if (!Number.isInteger(guildId) || guildId <= 0) {
    return new Response("invalid id", { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const guildRows = await tx
        .select()
        .from(guilds)
        .where(and(eq(guilds.id, guildId), isNull(guilds.disbandedAt)))
        .for("update");
      const guild = guildRows[0];
      if (!guild) {
        return { error: "guild_not_found", status: 404 as const };
      }

      const myMembership = await tx
        .select()
        .from(guildMembers)
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, userId),
          ),
        )
        .limit(1);
      if (myMembership.length === 0) {
        return { error: "not_member", status: 403 as const };
      }

      const memberCountRows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(guildMembers)
        .where(eq(guildMembers.guildId, guildId));
      const memberCount = Number(memberCountRows[0]?.count ?? 0);

      const isMaster = guild.masterId === userId;
      if (isMaster && memberCount > 1) {
        return { error: "master_must_transfer", status: 409 as const };
      }

      await tx
        .delete(guildMembers)
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, userId),
          ),
        );

      await clearAffiliationInTx(tx, userId);

      const cooldownUntil = new Date(
        Date.now() + GUILD_LEAVE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
      );
      await tx
        .insert(guildLeaveCooldown)
        .values({ userId, cooldownUntil })
        .onConflictDoUpdate({
          target: guildLeaveCooldown.userId,
          set: { cooldownUntil },
        });

      if (isMaster && memberCount === 1) {
        await tx
          .update(guilds)
          .set({ disbandedAt: new Date() })
          .where(eq(guilds.id, guildId));
        await tx
          .update(marketplaceInbox)
          .set({ claimedAt: new Date() })
          .where(
            and(
              eq(marketplaceInbox.kind, "guild_invite"),
              sql`${marketplaceInbox.payload}->>'guild_id' = ${String(guildId)}`,
              isNull(marketplaceInbox.claimedAt),
            ),
          );
        return { ok: true as const, disbanded: true };
      }

      return { ok: true as const, disbanded: false };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.leave.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
