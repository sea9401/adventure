import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";

const VALID_METRICS = ["level", "fame", "battleCount"] as const;
type Metric = (typeof VALID_METRICS)[number];
const isMetric = (v: string): v is Metric =>
  (VALID_METRICS as readonly string[]).includes(v);

const LIST_LIMIT = 100;
// 메모리 캐시 TTL — 리더보드는 약간 stale 해도 무방. 매 요청마다 saves_kv 의
// adventure-log.v2 jsonb 를 jsonb_each 로 풀스캔(모든 유저 × 모든 몬스터 kills
// 합산)하던 핫경로를 30초 캐시로 막는다. 단일 EC2 라 in-process 캐시면 충분.
// 캐시 미스만 SQL — 같은 metric 의 동시 cold-miss 는 inFlight promise 로 dedup.
const CACHE_TTL_MS = 30_000;

type RankRow = {
  userId: string;
  name: string;
  level: number;
  fame: number;
  battleCount: number;
  rank: number;
};

type CacheEntry = {
  rows: RankRow[];
  computedAt: number;
  inFlight?: Promise<RankRow[]>;
};

const cache: Map<Metric, CacheEntry> = new Map();

async function fetchRows(metric: Metric): Promise<RankRow[]> {
  // metric 은 isMetric 으로 검증된 닫힌 enum — sql 템플릿에 안전하게 합성.
  const orderBy =
    metric === "level"
      ? sql`level DESC, updated_at ASC`
      : metric === "fame"
        ? sql`fame DESC, updated_at ASC`
        : sql`battle_count DESC, updated_at ASC`;

  // 닉네임은 users.game_name 우선, 없으면 character-profile.v2 의 name fallback.
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
      SELECT *, ROW_NUMBER() OVER (ORDER BY ${orderBy})::int AS rank
      FROM stats
    )
    SELECT user_id, name, level, fame, battle_count, rank
    FROM ranked
    ORDER BY rank
  `);

  type DbRow = {
    user_id: string;
    name: string;
    level: number;
    fame: number;
    battle_count: number;
    rank: number;
  };
  return (result.rows as unknown as DbRow[]).map((r) => ({
    userId: String(r.user_id),
    name: String(r.name),
    level: Number(r.level),
    fame: Number(r.fame),
    battleCount: Number(r.battle_count),
    rank: Number(r.rank),
  }));
}

async function getRows(metric: Metric): Promise<RankRow[]> {
  const now = Date.now();
  const entry = cache.get(metric);
  if (entry && now - entry.computedAt < CACHE_TTL_MS) {
    return entry.rows;
  }
  if (entry?.inFlight) return entry.inFlight;

  const promise = fetchRows(metric).then(
    (rows) => {
      cache.set(metric, { rows, computedAt: Date.now() });
      return rows;
    },
    (err: unknown) => {
      // 실패 시 inFlight 만 클리어해 다음 요청이 재시도 — 기존 stale 캐시는 보존.
      const e = cache.get(metric);
      if (e && e.inFlight === promise) {
        cache.set(metric, { rows: e.rows, computedAt: e.computedAt });
      }
      throw err;
    },
  );
  cache.set(metric, {
    rows: entry?.rows ?? [],
    computedAt: entry?.computedAt ?? 0,
    inFlight: promise,
  });
  return promise;
}

// GET /api/rankings?metric=level|fame|battleCount
// 응답: { list: 상위 LIST_LIMIT, me: 본인 row+rank | null }.
// 본인 row 도 캐시 스냅샷에서 찾으므로 갓 레벨업한 직후엔 다음 캐시 갱신까지
// 갱신값이 안 보일 수 있음 (의도된 trade-off — 부하 대비 30초 staleness).
export async function GET(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const metric = url.searchParams.get("metric") ?? "level";
  if (!isMetric(metric)) {
    return new Response(`unknown metric: ${metric}`, { status: 400 });
  }

  const rows = await getRows(metric);

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
