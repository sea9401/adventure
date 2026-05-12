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
import { insertFeedEntry } from "@/lib/server/serverFeed";

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
    // 걸작(tier 2) 장비 제작 성공 → 전체 소식에 한 줄 (부수 효과 — 내부에서 self-catch).
    // 등급 추첨은 variance 가 있는 "진짜 제작 장비" 레시피에서만 일어나므로 별도 게이트 불필요.
    if (outcome.result.kind === "equipment" && outcome.result.tier === 2) {
      await insertFeedEntry(userId, "masterpiece", {
        itemId: outcome.result.itemId,
      });
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
