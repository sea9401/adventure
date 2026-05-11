import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { guildMembers, guilds } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { gradeForFame } from "@/adventure/data/guildQuests";
import {
  GUILD_BUFFS,
  buffSlotsForGrade,
  type GuildBuffSlot,
} from "@/adventure/data/guildBuffs";

// GET /api/guilds/buffs — 내 길드의 현재 버프 슬롯 + 카탈로그 + 잔여 fameAvailable + 슬롯 한도.
// 길드 미가입이면 guild=null.
export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const myRows = await db
    .select({ guildId: guildMembers.guildId })
    .from(guildMembers)
    .where(eq(guildMembers.userId, userId))
    .limit(1);
  if (myRows.length === 0) {
    return Response.json({ guild: null });
  }
  const { guildId } = myRows[0];

  const guildRows = await db
    .select()
    .from(guilds)
    .where(and(eq(guilds.id, guildId), isNull(guilds.disbandedAt)))
    .limit(1);
  if (guildRows.length === 0) {
    return Response.json({ guild: null });
  }
  const guild = guildRows[0];
  const grade = gradeForFame(guild.fameTotal);
  const maxSlots = buffSlotsForGrade(grade);

  return Response.json({
    guild: {
      id: guild.id,
      isMaster: guild.masterId === userId,
      fameAvailable: guild.fameAvailable,
      fameTotal: guild.fameTotal,
      grade,
      maxSlots,
      buffs: guild.buffs as GuildBuffSlot[],
    },
    catalog: GUILD_BUFFS,
  });
}
