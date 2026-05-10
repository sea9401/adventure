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
      if (guild.masterId !== userId) {
        return { error: "not_master", status: 403 as const };
      }

      const members = await tx
        .select({ userId: guildMembers.userId })
        .from(guildMembers)
        .where(eq(guildMembers.guildId, guildId));

      for (const m of members) {
        await clearAffiliationInTx(tx, m.userId);
      }
      await tx.delete(guildMembers).where(eq(guildMembers.guildId, guildId));

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

      return { ok: true as const };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.disband.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
