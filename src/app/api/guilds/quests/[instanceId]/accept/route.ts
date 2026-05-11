import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { guildQuestInstances, guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

// POST /api/guilds/quests/[instanceId]/accept — 마스터의 의뢰 수락 (하위호환).
// 신규 발행분은 즉시 active 로 발행되므로 이 API 는 기존 proposed 행이 남아있을 때만 사용.
// 클릭된 의뢰와 같은 weekStart 의 proposed 행을 모두 active 로 전환 (택1 아님).
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

      // 같은 weekStart 의 proposed 행을 모두 active 로 전환 (3개 동시 진행).
      const now = new Date();
      await tx
        .update(guildQuestInstances)
        .set({ status: "active", activatedAt: now })
        .where(
          and(
            eq(guildQuestInstances.guildId, inst.guildId),
            eq(guildQuestInstances.weekStart, inst.weekStart),
            eq(guildQuestInstances.status, "proposed"),
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
