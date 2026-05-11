import { eq } from "drizzle-orm";
import { db } from "@/db";
import { guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import {
  isGuildBuffId,
  slotInvestedFor,
  type GuildBuffSlot,
} from "@/adventure/data/guildBuffs";

// POST /api/guilds/buffs/uninstall — 설치된 버프 슬롯 해제. 누적 투자의 50% 환급.
// body: { buffId: GuildBuffId }
// 거부: 마스터 아님 / 미설치.
export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: { buffId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (!isGuildBuffId(body.buffId)) {
    return Response.json({ error: "invalid_buff_id" }, { status: 400 });
  }
  const buffId = body.buffId;

  try {
    const result = await db.transaction(async (tx) => {
      const guildRows = await tx
        .select()
        .from(guilds)
        .where(eq(guilds.masterId, userId))
        .for("update");
      const guild = guildRows[0];
      if (!guild) return { error: "not_master", status: 403 as const };
      if (guild.disbandedAt !== null) {
        return { error: "guild_disbanded", status: 410 as const };
      }

      const current = (guild.buffs as GuildBuffSlot[]) ?? [];
      if (!current.some((s) => s.buffId === buffId)) {
        return { error: "not_installed", status: 409 as const };
      }
      const refund = Math.floor(slotInvestedFor(current, buffId) * 0.5);
      const nextBuffs = current.filter((s) => s.buffId !== buffId);

      const upd = await tx
        .update(guilds)
        .set({
          buffs: nextBuffs,
          fameAvailable: guild.fameAvailable + refund,
        })
        .where(eq(guilds.id, guild.id))
        .returning({
          buffs: guilds.buffs,
          fameAvailable: guilds.fameAvailable,
        });
      return {
        ok: true as const,
        buffs: upd[0].buffs as GuildBuffSlot[],
        fameAvailable: upd[0].fameAvailable,
        refunded: refund,
      };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.buffs.uninstall.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
