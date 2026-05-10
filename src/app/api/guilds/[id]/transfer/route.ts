import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { guildMembers, guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

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
  const newMasterId = body.userId;

  if (newMasterId === userId) {
    return Response.json({ error: "self_transfer" }, { status: 400 });
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

      const targetRows = await tx
        .select()
        .from(guildMembers)
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, newMasterId),
          ),
        )
        .limit(1);
      if (targetRows.length === 0) {
        return { error: "target_not_member", status: 404 as const };
      }

      await tx
        .update(guildMembers)
        .set({ role: "member" })
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, userId),
          ),
        );
      await tx
        .update(guildMembers)
        .set({ role: "master" })
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, newMasterId),
          ),
        );
      await tx
        .update(guilds)
        .set({ masterId: newMasterId })
        .where(eq(guilds.id, guildId));

      return { ok: true as const };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.transfer.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
