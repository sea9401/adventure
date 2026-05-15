// POST /api/tower — 고탑 서버 권위 액션 (start / fight_floor / forfeit).
//
// body: { kind: "start", startFloor?: number }  // startFloor 는 availableStartFloors 안의 값
//     | { kind: "fight_floor" }                 // 서버가 outcome 결정 (anti-cheat)
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

  let body: { kind?: unknown; startFloor?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  let action: TowerRequestAction;
  if (body.kind === "start") {
    // startFloor 는 양의 정수만 허용 — 그 외 모두 미동봉 처리 → compute 가 기본 동작(체크포인트).
    // 허용 목록 검증은 compute 단계 (invalid_start_floor).
    const sf = body.startFloor;
    const startFloor =
      typeof sf === "number" && Number.isInteger(sf) && sf > 0 ? sf : undefined;
    action = { kind: "start", startFloor };
  } else if (body.kind === "forfeit") {
    action = { kind: "forfeit" };
  } else if (body.kind === "fight_floor") {
    action = { kind: "fight_floor" };
  } else if (body.kind === "fight_floors_auto") {
    action = { kind: "fight_floors_auto" };
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
