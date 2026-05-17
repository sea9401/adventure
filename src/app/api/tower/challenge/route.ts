// POST /api/tower/challenge — 고탑 도전 모드 (Phase 3-2) 서버 권위 액션.
//
// body: { kind: "start" }       // 시작층은 항상 F1 (체크포인트 / startFloor 없음)
//     | { kind: "fight_floor" } // 서버가 outcome 결정 (anti-cheat)
//     | { kind: "forfeit" }
//
// 응답: 200 { ok: true, challenge, applied, battle? }
//       400 { ok: false, error: <TowerChallengeError code> }
//       401/500 standard
//
// fight_floor 는 1.5× HP/ATK/DEF 스케일링 적용. F50 보스 클리어 시 tower_challenge_f50 칭호
// 자동 부여 (applied.grantedTitleId 로 클라에 통보).

import { db } from "@/db";
import { ensureUser } from "@/lib/server/ensureUser";
import { checkSession } from "@/lib/server/checkSession";
import {
  TowerChallengeError,
  applyTowerChallengeAction,
  type TowerChallengeOutcome,
  type TowerChallengeRequestAction,
} from "@/lib/server/tower-challenge/apply";

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

  let action: TowerChallengeRequestAction;
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
    const outcome: TowerChallengeOutcome = await db.transaction((tx) =>
      applyTowerChallengeAction(tx, userId, action),
    );
    return Response.json({ ok: true, ...outcome });
  } catch (e) {
    if (e instanceof TowerChallengeError) {
      return Response.json({ ok: false, error: e.code }, { status: 400 });
    }
    console.error("[tower-challenge]", e);
    return new Response("internal error", { status: 500 });
  }
}
