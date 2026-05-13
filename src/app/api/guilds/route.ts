import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  guildLeaveCooldown,
  guildMembers,
  guilds,
  savesKv,
} from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { upsertSave } from "@/lib/server/savesKv";
import { SAVES_CHARACTER } from "@/lib/server/guildAffiliation";
import { cancelPendingJoinRequestsInTx } from "@/lib/server/guildJoinRequests";
import {
  GUILD_CREATE_GOLD,
  GUILD_CREATE_LEVEL,
  GUILD_CREATE_QUEST_COUNT,
  validateGuildName,
} from "@/adventure/data/guild";

const QUEST_PROGRESS_KEY = "quest-progress.v2";

// POST /api/guilds — 길드 생성.
// 조건: 레벨 >= 5 OR 완료 의뢰 >= 5종, 200G 보유, 다른 길드 미소속, 탈퇴 쿨다운 없음, 이름 검증.
export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: { name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (typeof body.name !== "string") {
    return new Response("name required", { status: 400 });
  }

  const validation = validateGuildName(body.name);
  if (!validation.ok) {
    return Response.json(
      { error: "name_invalid", message: validation.reason },
      { status: 400 },
    );
  }
  const name = validation.trimmed;

  try {
    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: guildMembers.guildId })
        .from(guildMembers)
        .where(eq(guildMembers.userId, userId))
        .limit(1);
      if (existing.length > 0) {
        return { error: "already_in_guild", status: 409 as const };
      }

      const cooldownRows = await tx
        .select()
        .from(guildLeaveCooldown)
        .where(eq(guildLeaveCooldown.userId, userId))
        .limit(1);
      if (cooldownRows[0] && cooldownRows[0].cooldownUntil > new Date()) {
        return {
          error: "cooldown",
          status: 409 as const,
          until: cooldownRows[0].cooldownUntil.toISOString(),
        };
      }

      const dupRows = await tx
        .select({ id: guilds.id })
        .from(guilds)
        .where(sql`lower(${guilds.name}) = lower(${name})`)
        .limit(1);
      if (dupRows.length > 0) {
        return { error: "name_taken", status: 409 as const };
      }

      const charRows = await tx
        .select()
        .from(savesKv)
        .where(
          and(eq(savesKv.userId, userId), eq(savesKv.key, SAVES_CHARACTER)),
        )
        .for("update");
      if (charRows.length === 0) {
        return { error: "no_character", status: 400 as const };
      }
      const character = charRows[0].value as Record<string, unknown>;
      const level = Number(character.level ?? 1);
      const gold = Number(character.gold ?? 0);

      const questRows = await tx
        .select()
        .from(savesKv)
        .where(
          and(eq(savesKv.userId, userId), eq(savesKv.key, QUEST_PROGRESS_KEY)),
        )
        .limit(1);
      let completedQuests = 0;
      if (questRows[0]) {
        const map = (questRows[0].value ?? {}) as Record<
          string,
          { completedCount?: number; state?: string }
        >;
        completedQuests = Object.values(map).filter(
          (q) => (q.completedCount ?? 0) > 0 || q.state === "completed",
        ).length;
      }

      const meetsLevel = level >= GUILD_CREATE_LEVEL;
      const meetsQuests = completedQuests >= GUILD_CREATE_QUEST_COUNT;
      if (!meetsLevel && !meetsQuests) {
        return {
          error: "requirements",
          status: 400 as const,
          level,
          quests: completedQuests,
        };
      }
      if (gold < GUILD_CREATE_GOLD) {
        return { error: "insufficient_gold", status: 400 as const };
      }

      await upsertSave(tx, userId, SAVES_CHARACTER, {
        ...character,
        gold: gold - GUILD_CREATE_GOLD,
        affiliation: name,
      });

      const inserted = await tx
        .insert(guilds)
        .values({ name, masterId: userId })
        .returning({ id: guilds.id });
      const newGuildId = inserted[0].id;
      await tx.insert(guildMembers).values({
        guildId: newGuildId,
        userId,
        role: "master",
      });
      // 길드를 만들었으니 그 유저의 pending 가입 신청은 정리.
      await cancelPendingJoinRequestsInTx(tx, userId);

      return {
        ok: true as const,
        guildId: newGuildId,
        name,
        newGold: gold - GUILD_CREATE_GOLD,
      };
    });

    if ("error" in result) {
      return Response.json(result, { status: result.status });
    }
    return Response.json(result);
  } catch (e) {
    console.error("[guilds.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
