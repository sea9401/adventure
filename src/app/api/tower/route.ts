// POST /api/tower — 고탑 서버 권위 액션 (start / fight_floor / forfeit).
//
// body: { kind: "start" }
//     | { kind: "fight_floor" }     // 서버가 outcome 결정 (anti-cheat)
//     | { kind: "forfeit" }
//
// 응답: 200 { ok: true, tower, character?, inventory?, applied, battle? }
//       400 { ok: false, error: <TowerError code> }
//       401/500 standard
//
// fight_floor 는 서버가 derivePlayerCombatFromSaves + resolveBattle 로 전투를 돌려
// 결과(승/패 + 최종 BattleState)를 응답에 동봉. 클라는 보낸 outcome 을 신뢰하지 않음.

import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import {
  TowerError,
  applyTowerAction,
  type TowerOutcome,
  type TowerRequestAction,
} from "@/lib/server/tower/apply";

export async function POST(req: Request) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const sessionFail = await checkSession(userId, req);
  if (sessionFail) return sessionFail;

  let body: { kind?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  let action: TowerRequestAction;
  if (body.kind === "start") {
    action = { kind: "start" };
  } else if (body.kind === "forfeit") {
    action = { kind: "forfeit" };
  } else if (body.kind === "fight_floor") {
    action = { kind: "fight_floor" };
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
