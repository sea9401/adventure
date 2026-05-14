// GET /api/hunt/status — 현재 자동 사냥(4시간 원정) 상태. 새로고침 후 카운트다운 복원용.
//
// 반환: { active:true, startedAt, regionId, durationMs, predictedDeathAt } | { active:false }
//   - predictedDeathAt: dispatch 시 pre-sim 으로 박힌 사망 예측 시각 (생존 예측이면 null).
//     알림 발화 시각 — 클라가 페이지 mount 마다 갱신해 setTimeout 재등록.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { AUTO_HUNT_DURATION_MS } from "@/adventure/battle/autoHunt";

type StatusResponse =
  | {
      active: true;
      startedAt: string;
      regionId: string;
      durationMs: number;
      predictedDeathAt: string | null;
    }
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
    predictedDeathAt: u.huntPredictedDeathAt?.toISOString() ?? null,
  } satisfies StatusResponse);
}
