// POST /api/enhance — 별빛 재단 무구 인스턴스를 +1 강화. 서버 권위.
//
// body: { instanceId: string }
//
// 흐름:
//   1) auth + session
//   2) 트랜잭션 안에서 inventory.v2 잠금 → 별빛 조각 차감 + 인스턴스 단계 +1
//   3) 새 inventory.v2 + toLevel + shardsSpent 반환 → 클라가 replace + 알림.

import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";
import { requireSessionHeader } from "@/lib/server/checkSession";
import { jsonError, jsonOk } from "@/lib/server/jsonResponse";
import {
  EnhanceError,
  applyEnhanceAction,
  type EnhanceOutcome,
} from "@/lib/server/enhance";

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return jsonError("unauthorized", 401);
  const sessionFail = await requireSessionHeader(userId, req);
  if (sessionFail) return sessionFail;

  let body: { instanceId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError("invalid_json");
  }
  // 길이 상한 — 정상 UUID 는 36자. 위조된 거대 문자열 차단.
  if (
    typeof body.instanceId !== "string" ||
    body.instanceId.length === 0 ||
    body.instanceId.length > 128
  ) {
    return jsonError("invalid_instance_id");
  }
  const instanceId = body.instanceId;

  try {
    const outcome: EnhanceOutcome = await db.transaction((tx) =>
      applyEnhanceAction(tx, userId, instanceId),
    );
    return jsonOk<EnhanceOutcome>(outcome);
  } catch (e) {
    if (e instanceof EnhanceError) {
      return jsonError(e.code);
    }
    console.error("[enhance]", e);
    return jsonError("internal_error", 500);
  }
}
