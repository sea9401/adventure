// POST /api/shop — 상점 buy / sell. 서버 권위 (audit-findings #1).
//
// body: { kind: ShopActionKind, id: string, quantity: number }
//   kind: buy_potion | buy_material | buy_consumable | sell_potion | sell_material | sell_equipment
//
// 흐름:
//   1) auth + session
//   2) 트랜잭션 안에서 character.v2 / inventory.v2 잠금 → 검증 → 적용 (upsertSave, version++)
//   3) 새 character.v2 / inventory.v2 값 + applied(실제 적용 결과) 반환
//      → 클라가 in-memory state 를 replace. 이어지는 useRemotePatch 자동 PATCH 는
//        409→currentVersion 재시도로 자가 수렴 (동일 값 재전송).

import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import {
  ShopError,
  applyShopAction,
  isShopActionKind,
  type ShopOutcome,
} from "@/lib/server/shop";

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  let body: {
    kind?: unknown;
    id?: unknown;
    quantity?: unknown;
    craftTier?: unknown;
    dropQuality?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (!isShopActionKind(body.kind)) {
    return new Response("invalid kind", { status: 400 });
  }
  if (typeof body.id !== "string" || body.id.length === 0) {
    return new Response("invalid id", { status: 400 });
  }
  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return new Response("invalid quantity", { status: 400 });
  }
  // sell_equipment 한정 옵션 — 제작 등급(±1·±2). 그 외 값/타입은 무시(= 무등급 취급).
  let craftTier: number | undefined;
  if (body.craftTier != null) {
    const t = Number(body.craftTier);
    if ([-2, -1, 1, 2].includes(t)) craftTier = t;
  }
  // sell_equipment 한정 옵션 — 드랍 품질 등급(1·2). craftTier 와 동시 지정 시 서버가 craftTier 우선.
  let dropQuality: number | undefined;
  if (body.dropQuality != null) {
    const q = Number(body.dropQuality);
    if ([1, 2].includes(q)) dropQuality = q;
  }

  const action = { kind: body.kind, id: body.id, quantity, craftTier, dropQuality };

  try {
    const outcome: ShopOutcome = await db.transaction((tx) =>
      applyShopAction(tx, userId, action),
    );
    return Response.json({ ok: true, ...outcome });
  } catch (e) {
    if (e instanceof ShopError) {
      return Response.json({ ok: false, error: e.code }, { status: 400 });
    }
    console.error("[shop]", e);
    return new Response("internal error", { status: 500 });
  }
}
