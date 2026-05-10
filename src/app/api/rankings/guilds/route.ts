import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";
import { gradeForFame } from "@/adventure/data/guildQuests";

const LIST_LIMIT = 100;

// GET /api/rankings/guilds — 활성 길드를 누적 명성(fameTotal) 내림차순으로 정렬.
// 동률은 createdAt 오래된 순. 응답에는 등급/멤버 수도 포함.
export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  // ranked: fameTotal DESC + createdAt ASC. 멤버 수는 LATERAL count 로.
  const result = await db.execute(sql`
    WITH stats AS (
      SELECT
        g.id AS guild_id,
        g.name AS name,
        g.fame_total AS fame_total,
        g.created_at AS created_at,
        (
          SELECT COUNT(*)::int
          FROM guild_members gm
          WHERE gm.guild_id = g.id
        ) AS member_count
      FROM guilds g
      WHERE g.disbanded_at IS NULL
    ),
    ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (ORDER BY fame_total DESC, created_at ASC)::int AS rank
      FROM stats
    )
    SELECT guild_id, name, fame_total, member_count, rank
    FROM ranked
    ORDER BY rank
  `);

  type Row = {
    guild_id: number;
    name: string;
    fame_total: number;
    member_count: number;
    rank: number;
  };
  const rows = (result.rows as unknown as Row[]).map((r) => ({
    rank: Number(r.rank),
    guildId: Number(r.guild_id),
    name: String(r.name),
    fameTotal: Number(r.fame_total),
    memberCount: Number(r.member_count),
  }));

  // 본인 길드 — 1회 쿼리로 결정. 가입 안 했거나 해체된 길드면 null.
  const myMembership = await db.execute(sql`
    SELECT gm.guild_id
    FROM guild_members gm
    JOIN guilds g ON g.id = gm.guild_id
    WHERE gm.user_id = ${userId} AND g.disbanded_at IS NULL
    LIMIT 1
  `);
  const myGuildId =
    myMembership.rows.length > 0
      ? Number((myMembership.rows[0] as { guild_id: number }).guild_id)
      : null;

  const list = rows.slice(0, LIST_LIMIT).map((r) => ({
    rank: r.rank,
    name: r.name,
    fameTotal: r.fameTotal,
    memberCount: r.memberCount,
    grade: gradeForFame(r.fameTotal),
    mine: r.guildId === myGuildId,
  }));

  const myRow =
    myGuildId !== null ? rows.find((r) => r.guildId === myGuildId) : undefined;
  const me = myRow
    ? {
        rank: myRow.rank,
        name: myRow.name,
        fameTotal: myRow.fameTotal,
        memberCount: myRow.memberCount,
        grade: gradeForFame(myRow.fameTotal),
      }
    : null;

  return Response.json({ list, me });
}
