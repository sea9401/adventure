import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rankings } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";

// GET /api/rankings/me — 본인 가입 여부 + 현재 등록된 스냅샷.
// 미가입 시 { registered: false }, 가입 시 { registered: true, ...row }.
export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const rows = await db
    .select({
      name: rankings.name,
      level: rankings.level,
      fame: rankings.fame,
      battleCount: rankings.battleCount,
      updatedAt: rankings.updatedAt,
    })
    .from(rankings)
    .where(eq(rankings.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ registered: false });
  }
  const r = rows[0];
  return Response.json({
    registered: true,
    name: r.name,
    level: r.level,
    fame: r.fame,
    battleCount: r.battleCount,
    updatedAt: r.updatedAt,
  });
}
