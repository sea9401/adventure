import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { GUILD_DESCRIPTION_MAX } from "@/adventure/data/guild";

// 길드 소개글 수정 — 마스터 전용. 빈 문자열은 NULL 로 클리어.
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

  let body: { description?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (typeof body.description !== "string") {
    return new Response("description required", { status: 400 });
  }
  const trimmed = body.description.trim();
  if (trimmed.length > GUILD_DESCRIPTION_MAX) {
    return Response.json({ error: "description_too_long" }, { status: 400 });
  }
  const next = trimmed.length === 0 ? null : trimmed;

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

      await tx
        .update(guilds)
        .set({ description: next })
        .where(eq(guilds.id, guildId));

      return { ok: true as const, description: next };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.description.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
