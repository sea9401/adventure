import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { rankings } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

const VALID_METRICS = ["level", "fame", "battleCount"] as const;
type Metric = (typeof VALID_METRICS)[number];
const isMetric = (v: string): v is Metric =>
  (VALID_METRICS as readonly string[]).includes(v);

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

// GET /api/rankings?metric=level|fame|battleCount&limit=100
// 상위 N 명 + 본인 row(있으면) 반환. mine 플래그로 본인 강조 가능.
export async function GET(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const metric = url.searchParams.get("metric") ?? "level";
  if (!isMetric(metric)) {
    return new Response(`unknown metric: ${metric}`, { status: 400 });
  }
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT),
  );

  const sortColumn =
    metric === "level"
      ? rankings.level
      : metric === "fame"
        ? rankings.fame
        : rankings.battleCount;

  // 동률 시 updatedAt 오름차순 (먼저 도달한 사람이 위) — 약한 tiebreak.
  const rows = await db
    .select({
      userId: rankings.userId,
      name: rankings.name,
      level: rankings.level,
      fame: rankings.fame,
      battleCount: rankings.battleCount,
      updatedAt: rankings.updatedAt,
    })
    .from(rankings)
    .orderBy(desc(sortColumn), rankings.updatedAt)
    .limit(limit);

  return Response.json(
    rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      level: r.level,
      fame: r.fame,
      battleCount: r.battleCount,
      mine: r.userId === userId,
    })),
  );
}

// POST /api/rankings — 본인 row upsert. body: { name, level, fame, battleCount }
// 미가입 상태면 신규 등록, 가입 상태면 갱신.
export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  let body: {
    name?: unknown;
    level?: unknown;
    fame?: unknown;
    battleCount?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const level = Number(body.level);
  const fame = Number(body.fame);
  const battleCount = Number(body.battleCount);

  if (!name) return new Response("missing name", { status: 400 });
  if (!Number.isFinite(level) || level < 1)
    return new Response("invalid level", { status: 400 });
  if (!Number.isFinite(fame) || fame < 0)
    return new Response("invalid fame", { status: 400 });
  if (!Number.isFinite(battleCount) || battleCount < 0)
    return new Response("invalid battleCount", { status: 400 });

  await db
    .insert(rankings)
    .values({
      userId,
      name,
      level: Math.floor(level),
      fame: Math.floor(fame),
      battleCount: Math.floor(battleCount),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: rankings.userId,
      set: {
        name,
        level: Math.floor(level),
        fame: Math.floor(fame),
        battleCount: Math.floor(battleCount),
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}

// DELETE /api/rankings — 본인 row 제거 (랭킹에서 빠지기).
export async function DELETE() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  await db.delete(rankings).where(eq(rankings.userId, userId));
  return Response.json({ ok: true });
}

// GET /api/rankings/me — 본인 row 단독 조회용은 별도 라우트로 두는 게 깔끔하지만
// 위 GET 응답에 mine 플래그가 있어 클라이언트에서 그걸로 파악 가능. 또한 본인이
// Top N 밖이어도 가입 여부는 알아야 하므로, 간단히 별도 endpoint 로 분리.
