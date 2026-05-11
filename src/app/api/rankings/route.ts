import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";

const VALID_METRICS = ["level", "fame", "battleCount"] as const;
type Metric = (typeof VALID_METRICS)[number];
const isMetric = (v: string): v is Metric =>
  (VALID_METRICS as readonly string[]).includes(v);

const LIST_LIMIT = 100;

// GET /api/rankings?metric=level|fame|battleCount
// 닉네임 보유 유저 전체를 character.v2 + adventure-log.v2 에서 derive 해 정렬.
// 응답: { list: 상위 LIST_LIMIT, me: 본인 row+rank | null }.
export async function GET(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const metric = url.searchParams.get("metric") ?? "level";
  if (!isMetric(metric)) {
    return new Response(`unknown metric: ${metric}`, { status: 400 });
  }

  // metric 은 isMetric 으로 검증된 닫힌 enum — sql 템플릿에 안전하게 합성.
  const orderBy =
    metric === "level"
      ? sql`level DESC, updated_at ASC`
      : metric === "fame"
        ? sql`fame DESC, updated_at ASC`
        : sql`battle_count DESC, updated_at ASC`;

  // 닉네임은 users.name (권위적, 신규 유저 setup 후) 우선,
  // 없으면 character-profile.v2 의 name 으로 fallback (레거시 유저 호환).
  const result = await db.execute(sql`
    WITH stats AS (
      SELECT
        u.id AS user_id,
        COALESCE(u.game_name, p.value->>'name') AS name,
        COALESCE((c.value->>'level')::int, 1) AS level,
        COALESCE((c.value->>'fame')::int, 0) AS fame,
        (
          COALESCE((
            SELECT SUM((m.value->>'kills')::int)
            FROM jsonb_each(l.value->'monsters') AS m
            WHERE (m.value->>'kills') IS NOT NULL
          ), 0)
          + COALESCE((l.value->>'battleLosses')::int, 0)
        ) AS battle_count,
        COALESCE(c.updated_at, u.created_at) AS updated_at
      FROM users u
      LEFT JOIN saves_kv c ON c.user_id = u.id AND c.key = 'character.v2'
      LEFT JOIN saves_kv l ON l.user_id = u.id AND l.key = 'adventure-log.v2'
      LEFT JOIN saves_kv p ON p.user_id = u.id AND p.key = 'character-profile.v2'
      WHERE COALESCE(u.game_name, p.value->>'name') IS NOT NULL
    ),
    ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (ORDER BY ${orderBy})::int AS rank
      FROM stats
    )
    SELECT user_id, name, level, fame, battle_count, rank
    FROM ranked
    ORDER BY rank
  `);

  type Row = {
    user_id: string;
    name: string;
    level: number;
    fame: number;
    battle_count: number;
    rank: number;
  };
  const rows = (result.rows as unknown as Row[]).map((r) => ({
    rank: Number(r.rank),
    userId: String(r.user_id),
    name: String(r.name),
    level: Number(r.level),
    fame: Number(r.fame),
    battleCount: Number(r.battle_count),
  }));

  const list = rows.slice(0, LIST_LIMIT).map((r) => ({
    rank: r.rank,
    name: r.name,
    level: r.level,
    fame: r.fame,
    battleCount: r.battleCount,
    mine: r.userId === userId,
  }));

  const myRow = rows.find((r) => r.userId === userId);
  const me = myRow
    ? {
        rank: myRow.rank,
        name: myRow.name,
        level: myRow.level,
        fame: myRow.fame,
        battleCount: myRow.battleCount,
      }
    : null;

  return Response.json({ list, me });
}
