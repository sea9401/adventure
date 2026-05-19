// POST /api/quests/claim — 퀘스트 보상 수령. 서버 권위 (EPIC #3-2).
//
// body: { questId: string }
//
// 흐름:
//   1) auth + session header 강제.
//   2) 길드 버프를 readonly fetch (멤버십은 tx 단위로 안 바뀜).
//   3) 트랜잭션: 7 saves 키 잠금 → quest entry state==="ready" 확인 → reward 적용 +
//      side effects (titles/flags) + quest entry 전환. 아니면 idempotent no-op.
//   4) 응답: { ok, applied, questTitle, tokens, saves }. 클라가 replaceFromSaved.

import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";
import { requireSessionHeader } from "@/lib/server/checkSession";
import { jsonError, jsonOk } from "@/lib/server/jsonResponse";
import { getActiveGuildBuffsForUser } from "@/lib/server/guildBuffs";
import {
  applyQuestClaim,
  QuestClaimError,
  type QuestClaimOutcome,
} from "@/lib/server/questReward";

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return jsonError("unauthorized", 401);
  const sessionFail = await requireSessionHeader(userId, req);
  if (sessionFail) return sessionFail;

  let body: { questId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError("invalid_json");
  }
  const questId = body.questId;
  if (typeof questId !== "string" || questId.length === 0 || questId.length > 128) {
    return jsonError("invalid_quest_id");
  }

  const guildBuffs = await getActiveGuildBuffsForUser(userId);

  try {
    const outcome: QuestClaimOutcome = await db.transaction((tx) =>
      applyQuestClaim(tx, userId, questId, guildBuffs),
    );
    return jsonOk<QuestClaimOutcome>(outcome);
  } catch (e) {
    if (e instanceof QuestClaimError) {
      return jsonError(e.code);
    }
    console.error("[quests/claim]", e);
    return jsonError("internal_error", 500);
  }
}
