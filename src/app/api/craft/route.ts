// POST /api/craft — 제작서로 장비/포션 제작. 서버 권위 (audit-findings #1 후속).
//
// body: { recipeId: string, quantity?: number (기본 1, 1..CRAFT_BATCH_MAX) }
//
// 흐름:
//   1) auth + session
//   2) 트랜잭션 안에서 inventory.v2 / crafting.v2 잠금 → 검증 → 적용
//      (재료 quantity 배 차감, 결과 N 회 지급, 등급 추첨도 회마다 독립, crafted 마커, version++)
//   3) 새 inventory.v2 / crafting.v2 값 + results: CraftResult[] 반환
//      → 클라가 in-memory state 를 replace 하고 results 를 풀어 알림 표시.
//        이어지는 useRemotePatch 자동 PATCH 는 409→currentVersion 재시도로 자가 수렴.

import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import { CraftError, applyCraftAction, type CraftOutcome } from "@/lib/server/craft";
import { CRAFT_BATCH_MAX } from "@/adventure/crafting/types";
import { insertFeedEntry } from "@/lib/server/serverFeed";

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  let body: { recipeId?: unknown; quantity?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (typeof body.recipeId !== "string" || body.recipeId.length === 0) {
    return new Response("invalid recipeId", { status: 400 });
  }
  const recipeId = body.recipeId;

  // quantity 미지정/undefined → 1 로 기본. 0/음수/소수/너무 큰 값은 400 에서 막는다.
  // computeCraftOutcome 도 동일 범위로 invalid_quantity 를 던지지만, 라우트에서
  // 미리 거절해 트랜잭션 자체를 안 열게 한다.
  let quantity = 1;
  if (body.quantity !== undefined) {
    if (
      typeof body.quantity !== "number" ||
      !Number.isInteger(body.quantity) ||
      body.quantity < 1 ||
      body.quantity > CRAFT_BATCH_MAX
    ) {
      return new Response("invalid quantity", { status: 400 });
    }
    quantity = body.quantity;
  }

  try {
    const outcome: CraftOutcome = await db.transaction((tx) =>
      applyCraftAction(tx, userId, recipeId, quantity),
    );
    // 걸작(tier 2) 장비 제작 성공 → 전체 소식에 한 줄 (부수 효과 — 내부에서 self-catch).
    // 배치 제작에선 회마다 독립이라 N 개 걸작이 한 번에 나올 수도 있다 — 각각 feed 한 줄.
    for (const r of outcome.results) {
      if (r.kind === "equipment" && r.tier === 2) {
        await insertFeedEntry(userId, "masterpiece", { itemId: r.itemId });
      }
    }
    return Response.json({ ok: true, ...outcome });
  } catch (e) {
    if (e instanceof CraftError) {
      return Response.json({ ok: false, error: e.code }, { status: 400 });
    }
    console.error("[craft]", e);
    return new Response("internal error", { status: 500 });
  }
}
