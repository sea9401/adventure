// POST /api/offline-hunt/start — 사용자가 자동 사냥 ON 토글 시 baseline 박음.
//
// body: 없음. 클라가 보내는 hp/region 등은 신뢰하지 않음 — 서버가 character.v2 / map.v2
// 에서 직접 읽음 (마을 회복 익스플로잇 차단).
//
// 흐름:
//   1) auth
//   2) 트랜잭션 안에서 character.v2 + map.v2 읽어 baseline hp / region 결정
//   3) users 의 hunt_* 컬럼 set + lastClaim* 초기화
// 반환: { ok: true, baselineAt: ISO string }

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savesKv } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import { updateBaseline } from "@/lib/server/offlineHunt";
import { START_REGION_ID, type RegionId } from "@/adventure/data/world";

type SavedCharacterV2 = { hp?: number };
type SavedMapV2 = { currentRegionId?: RegionId };

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  try {
    const now = new Date();
    await db.transaction(async (tx) => {
      const charRows = await tx
        .select({ value: savesKv.value })
        .from(savesKv)
        .where(
          and(eq(savesKv.userId, userId), eq(savesKv.key, "character.v2")),
        )
        .limit(1);
      const character = (charRows[0]?.value as SavedCharacterV2 | undefined) ?? {};
      const hp = Math.max(0, character.hp ?? 0);

      const mapRows = await tx
        .select({ value: savesKv.value })
        .from(savesKv)
        .where(and(eq(savesKv.userId, userId), eq(savesKv.key, "map.v2")))
        .limit(1);
      const map = (mapRows[0]?.value as SavedMapV2 | undefined) ?? {};
      const region = map.currentRegionId ?? START_REGION_ID;

      await updateBaseline(tx, userId, {
        huntActive: true,
        huntRegion: region,
        huntBaselineHp: hp,
        huntBaselineAt: now,
        lastClaimId: null,
        lastClaimResult: null,
      });
    });
    return Response.json({ ok: true, baselineAt: now.toISOString() });
  } catch (e) {
    console.error("[offline-hunt.start]", e);
    return new Response("internal error", { status: 500 });
  }
}
