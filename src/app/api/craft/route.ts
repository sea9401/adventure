// POST /api/craft — 제작서로 장비/포션 제작. 서버 권위 (audit-findings #1 후속).
//
// body: { recipeId: string }
//
// 흐름:
//   1) auth + session
//   2) 트랜잭션 안에서 inventory.v2 / crafting.v2 잠금 → 검증 → 적용
//      (재료 차감, 결과 지급, 제작 품질 등급 서버 추첨, crafted 마커, upsertSave version++)
//   3) 새 inventory.v2 / crafting.v2 값 + result(itemId+tier 또는 potionId+quantity) 반환
//      → 클라가 in-memory state 를 replace. 이어지는 useRemotePatch 자동 PATCH 는
//        409→currentVersion 재시도로 자가 수렴 (상점과 동일).

import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import { CraftError, applyCraftAction, type CraftOutcome } from "@/lib/server/craft";

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  let body: { recipeId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (typeof body.recipeId !== "string" || body.recipeId.length === 0) {
    return new Response("invalid recipeId", { status: 400 });
  }
  const recipeId = body.recipeId;

  try {
    const outcome: CraftOutcome = await db.transaction((tx) =>
      applyCraftAction(tx, userId, recipeId),
    );
    return Response.json({ ok: true, ...outcome });
  } catch (e) {
    if (e instanceof CraftError) {
      return Response.json({ ok: false, error: e.code }, { status: 400 });
    }
    console.error("[craft]", e);
    return new Response("internal error", { status: 500 });
  }
}
