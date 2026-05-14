// POST /api/tower — 고탑 서버 권위 액션 (start / fight_floor / forfeit).
//
// body: { kind: "start" }
//     | { kind: "fight_floor", outcome: "win" | "lose" }
//     | { kind: "forfeit" }
//
// 응답: 200 { ok: true, tower, character?, inventory?, applied }
//       400 { ok: false, error: <TowerError code> }
//       401/500 standard
//
// PR-1b 노트: fight_floor 의 outcome 은 클라이언트 보고. 서버측 battle simulation 은
// 추후 도입 예정 (anti-cheat 강화). 상태 무결성(시도 카운트/체크포인트/마일스톤)은 서버 권위.

import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import {
  TowerError,
  applyTowerAction,
  type TowerOutcome,
} from "@/lib/server/tower/apply";
import type { TowerAction } from "@/lib/server/tower/compute";

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  let body: { kind?: unknown; outcome?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  let action: TowerAction;
  if (body.kind === "start") {
    action = { kind: "start" };
  } else if (body.kind === "forfeit") {
    action = { kind: "forfeit" };
  } else if (body.kind === "fight_floor") {
    if (body.outcome !== "win" && body.outcome !== "lose") {
      return Response.json({ ok: false, error: "invalid_outcome" }, { status: 400 });
    }
    action = { kind: "fight_floor", outcome: body.outcome };
  } else {
    return Response.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }

  try {
    const outcome: TowerOutcome = await db.transaction((tx) =>
      applyTowerAction(tx, userId, action),
    );
    return Response.json({ ok: true, ...outcome });
  } catch (e) {
    if (e instanceof TowerError) {
      return Response.json({ ok: false, error: e.code }, { status: 400 });
    }
    console.error("[tower]", e);
    return new Response("internal error", { status: 500 });
  }
}
