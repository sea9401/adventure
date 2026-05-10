import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  guildMembers,
  guildQuestInstances,
  guilds,
  marketplaceInbox,
} from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import {
  QUEST_PROGRESS_CAP_PER_CALL,
  getGuildQuestById,
} from "@/adventure/data/guildQuests";

// POST /api/guilds/quests/progress — 멤버의 활동을 활성 의뢰 카운터에 반영.
// body: { kind: 'kill_monster'|'kill_boss'|'collect_material', name?, materialId?, count }
// 활성 의뢰가 없거나 task 와 안 맞으면 silent ignore (성공 응답 + matched=false).
// progress += min(count, target-progress, CAP). target 도달 시 자동 완료 + 보상 우편.
export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: {
    kind?: unknown;
    name?: unknown;
    materialId?: unknown;
    count?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const reqKind = body.kind;
  const reqCount = Math.floor(Number(body.count));
  if (
    typeof reqKind !== "string" ||
    !Number.isFinite(reqCount) ||
    reqCount <= 0
  ) {
    return new Response("invalid body", { status: 400 });
  }
  const delta = Math.min(reqCount, QUEST_PROGRESS_CAP_PER_CALL);

  try {
    const result = await db.transaction(async (tx) => {
      // 본인 길드 멤버십.
      const myRows = await tx
        .select({ guildId: guildMembers.guildId })
        .from(guildMembers)
        .where(eq(guildMembers.userId, userId))
        .limit(1);
      if (myRows.length === 0) {
        return { ok: true as const, matched: false, reason: "no_guild" };
      }
      const guildId = myRows[0].guildId;

      // 길드 + 활성 의뢰 잠금.
      const guildRows = await tx
        .select()
        .from(guilds)
        .where(and(eq(guilds.id, guildId), isNull(guilds.disbandedAt)))
        .for("update");
      if (guildRows.length === 0) {
        return { ok: true as const, matched: false, reason: "no_guild" };
      }
      const guild = guildRows[0];

      const activeRows = await tx
        .select()
        .from(guildQuestInstances)
        .where(
          and(
            eq(guildQuestInstances.guildId, guildId),
            eq(guildQuestInstances.status, "active"),
          ),
        )
        .for("update");
      const inst = activeRows[0];
      if (!inst) {
        return { ok: true as const, matched: false, reason: "no_active" };
      }

      // task 매칭 검사 — questDef 의 task 와 정확히 일치할 때만 카운트.
      const def = getGuildQuestById(inst.questDefId);
      if (!def) {
        return { ok: true as const, matched: false, reason: "def_missing" };
      }
      const t = def.task;
      let matched = false;
      if (t.kind === "kill_monster" && reqKind === "kill_monster") {
        matched = body.name === t.monsterName;
      } else if (t.kind === "kill_boss" && reqKind === "kill_boss") {
        matched = body.name === t.monsterName;
      } else if (
        t.kind === "collect_material" &&
        reqKind === "collect_material"
      ) {
        matched = body.materialId === t.materialId;
      }
      if (!matched) {
        return { ok: true as const, matched: false, reason: "no_match" };
      }

      const before = inst.progress;
      const target = inst.target;
      const next = Math.min(before + delta, target);
      const reachedTarget = next >= target;
      const now = new Date();

      await tx
        .update(guildQuestInstances)
        .set({
          progress: next,
          status: reachedTarget ? "completed" : "active",
          completedAt: reachedTarget ? now : null,
        })
        .where(eq(guildQuestInstances.id, inst.id));

      let fameAdded = 0;
      if (reachedTarget) {
        // 보상 — 길드 명성 양쪽 컬럼 + 멤버 각자 우편.
        fameAdded = def.reward.fame;
        await tx
          .update(guilds)
          .set({
            fameTotal: sql`${guilds.fameTotal} + ${fameAdded}`,
            fameAvailable: sql`${guilds.fameAvailable} + ${fameAdded}`,
          })
          .where(eq(guilds.id, guildId));

        const memberRows = await tx
          .select({ userId: guildMembers.userId })
          .from(guildMembers)
          .where(eq(guildMembers.guildId, guildId));

        for (const m of memberRows) {
          await tx.insert(marketplaceInbox).values({
            userId: m.userId,
            kind: "guild_quest_reward",
            payload: {
              quest_id: def.id,
              quest_name: def.name,
              gold: def.reward.goldPerMember,
              materials: def.reward.materialsPerMember ?? [],
              items: def.reward.itemsPerMember ?? [],
            },
            message: `${def.name} 완료 보상`,
          });
        }
      }

      return {
        ok: true as const,
        matched: true,
        progress: next,
        target,
        completed: reachedTarget,
        fameAdded,
      };
    });

    return Response.json(result);
  } catch (e) {
    console.error("[guilds.quests.progress.POST] ", e);
    return new Response("internal error", { status: 500 });
  }
}
