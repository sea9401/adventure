import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { guildQuestInstances, guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

// POST /api/guilds/quests/[instanceId]/accept — 마스터의 의뢰 수락.
// proposed → active. 같은 weekStart 의 다른 proposed 들은 dismissed.
// 동시 활성 1개는 partial unique index 가 enforce.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const { instanceId: idStr } = await params;
  const instanceId = Number(idStr);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    return new Response("invalid id", { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const insRows = await tx
        .select()
        .from(guildQuestInstances)
        .where(eq(guildQuestInstances.id, instanceId))
        .for("update");
      const inst = insRows[0];
      if (!inst) {
        return { error: "instance_not_found", status: 404 as const };
      }
      if (inst.status !== "proposed") {
        return { error: "instance_not_proposed", status: 409 as const };
      }

      const guildRows = await tx
        .select()
        .from(guilds)
        .where(eq(guilds.id, inst.guildId))
        .limit(1);
      const guild = guildRows[0];
      if (!guild || guild.disbandedAt !== null) {
        return { error: "guild_not_found", status: 404 as const };
      }
      if (guild.masterId !== userId) {
        return { error: "not_master", status: 403 as const };
      }

      // 같은 길드에 이미 활성 의뢰가 있으면 거부.
      const activeRows = await tx
        .select({ id: guildQuestInstances.id })
        .from(guildQuestInstances)
        .where(
          and(
            eq(guildQuestInstances.guildId, inst.guildId),
            eq(guildQuestInstances.status, "active"),
          ),
        )
        .limit(1);
      if (activeRows.length > 0) {
        return { error: "already_active", status: 409 as const };
      }

      const now = new Date();
      await tx
        .update(guildQuestInstances)
        .set({ status: "active", activatedAt: now })
        .where(eq(guildQuestInstances.id, instanceId));

      // 같은 weekStart 의 다른 proposed → dismissed.
      await tx
        .update(guildQuestInstances)
        .set({ status: "dismissed" })
        .where(
          and(
            eq(guildQuestInstances.guildId, inst.guildId),
            eq(guildQuestInstances.weekStart, inst.weekStart),
            eq(guildQuestInstances.status, "proposed"),
            ne(guildQuestInstances.id, instanceId),
          ),
        );

      return { ok: true as const };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.quests.accept.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
