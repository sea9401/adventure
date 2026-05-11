import { eq } from "drizzle-orm";
import { db } from "@/db";
import { guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { gradeForFame } from "@/adventure/data/guildQuests";
import {
  GUILD_BUFFS,
  buffSlotsForGrade,
  isGuildBuffId,
  type GuildBuffSlot,
} from "@/adventure/data/guildBuffs";

// POST /api/guilds/buffs/install — 빈 슬롯에 새 버프를 T1 으로 설치.
// body: { buffId: GuildBuffId }
// 거부: 마스터 아님 / 슬롯 부족 / 같은 종류 이미 설치됨 / fameAvailable 부족.
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
  const t1 = GUILD_BUFFS[buffId].tiers[0];

  try {
    const result = await db.transaction(async (tx) => {
      // 행 잠금 — JSONB read-modify-write 라 잠금 필수.
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
      if (current.some((s) => s.buffId === buffId)) {
        return { error: "already_installed", status: 409 as const };
      }
      const maxSlots = buffSlotsForGrade(gradeForFame(guild.fameTotal));
      if (current.length >= maxSlots) {
        return { error: "no_slot", status: 409 as const };
      }
      if (guild.fameAvailable < t1.installCost) {
        return { error: "insufficient_fame", status: 409 as const };
      }

      const nextBuffs: GuildBuffSlot[] = [
        ...current,
        { buffId, tier: 1, installedAt: new Date().toISOString() },
      ];
      const upd = await tx
        .update(guilds)
        .set({
          buffs: nextBuffs,
          fameAvailable: guild.fameAvailable - t1.installCost,
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
        spent: t1.installCost,
      };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.buffs.install.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
