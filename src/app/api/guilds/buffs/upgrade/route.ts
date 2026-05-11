import { eq } from "drizzle-orm";
import { db } from "@/db";
import { guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import {
  GUILD_BUFFS,
  isGuildBuffId,
  type GuildBuffSlot,
  type GuildBuffTier,
} from "@/adventure/data/guildBuffs";

// POST /api/guilds/buffs/upgrade — 설치된 버프의 티어 +1.
// body: { buffId: GuildBuffId }
// 거부: 마스터 아님 / 미설치 / 이미 T5 / fameAvailable 부족.
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
      const idx = current.findIndex((s) => s.buffId === buffId);
      if (idx < 0) return { error: "not_installed", status: 409 as const };

      const slot = current[idx];
      if (slot.tier >= 5) {
        return { error: "max_tier", status: 409 as const };
      }
      const nextTier = (slot.tier + 1) as GuildBuffTier;
      const nextTierDef = GUILD_BUFFS[buffId].tiers[nextTier - 1];
      if (!nextTierDef) {
        return { error: "max_tier", status: 409 as const };
      }
      if (guild.fameAvailable < nextTierDef.installCost) {
        return { error: "insufficient_fame", status: 409 as const };
      }

      const nextBuffs: GuildBuffSlot[] = current.map((s, i) =>
        i === idx ? { ...s, tier: nextTier } : s,
      );
      const upd = await tx
        .update(guilds)
        .set({
          buffs: nextBuffs,
          fameAvailable: guild.fameAvailable - nextTierDef.installCost,
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
        spent: nextTierDef.installCost,
        newTier: nextTier,
      };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.buffs.upgrade.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
