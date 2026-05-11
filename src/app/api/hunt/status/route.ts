// GET /api/hunt/status — 현재 자동 사냥(1시간 원정) 상태. 새로고침 후 카운트다운 복원용.
//
// 반환: { active:true, startedAt, regionId, durationMs } | { active:false }

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { AUTO_HUNT_DURATION_MS } from "@/adventure/battle/autoHunt";

type StatusResponse =
  | { active: true; startedAt: string; regionId: string; durationMs: number }
  | { active: false };

export async function GET() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const u = rows[0];
  if (!u || !u.huntActive || !u.huntBaselineAt) {
    return Response.json({ active: false } satisfies StatusResponse);
  }
  return Response.json({
    active: true,
    startedAt: u.huntBaselineAt.toISOString(),
    regionId: u.huntRegion ?? "",
    durationMs: AUTO_HUNT_DURATION_MS,
  } satisfies StatusResponse);
}
