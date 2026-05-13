import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

// POST /api/guilds/[id]/accepting-requests — 마스터가 가입 신청 받기 on/off.
// body: { accepting: boolean }
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

  let body: { accepting?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (typeof body.accepting !== "boolean") {
    return new Response("accepting required", { status: 400 });
  }
  const accepting = body.accepting;

  try {
    const result = await db.transaction(async (tx) => {
      const guildRows = await tx
        .select()
        .from(guilds)
        .where(and(eq(guilds.id, guildId), isNull(guilds.disbandedAt)))
        .for("update");
      const guild = guildRows[0];
      if (!guild) return { error: "guild_not_found", status: 404 as const };
      if (guild.masterId !== userId) {
        return { error: "not_master", status: 403 as const };
      }
      await tx
        .update(guilds)
        .set({ acceptingRequests: accepting })
        .where(eq(guilds.id, guildId));
      return { ok: true as const, acceptingRequests: accepting };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.accepting-requests.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
