// GET /api/pvp/matches/[id] — 본인이 참여한 단일 매치의 풀로그.
//
// /api/pvp/status 의 recent 는 요약만 — 사용자가 특정 매치를 펼쳤을 때만 lazy fetch.
// 평소 egress 를 status 응답 크기 (20×풀로그) 폭증 없이 작게 유지.
//
// 권한: 호출자가 attacker 또는 defender 였던 매치만 — 봇 매치 포함 (호출자 입장에선 챌린저).
// 다른 사람 매치 조회 차단 (privacy + 사이드 변환의 의미가 다름).
//
// 응답: { log, turns, outcome, opponent, ratingBefore, ratingAfter, ratingDelta, iAmAttacker, createdAt }
// log 는 호출자 시점으로 toMyPerspective 적용된 BattleLogEntry[].

import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { pvpMatches } from "@/db/schema";
import { ensureUser } from "@/lib/server/ensureUser";
import { resolveActor } from "@/lib/server/resolveActor";
import { toMyPerspective } from "@/lib/server/pvp/log";
import { isBotId } from "@/lib/server/pvp/bots";
import type { BattleLogEntry } from "@/adventure/battle/engine";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    return new Response("invalid id", { status: 400 });
  }

  const rows = await db
    .select()
    .from(pvpMatches)
    .where(
      and(
        eq(pvpMatches.id, id),
        or(
          eq(pvpMatches.attackerId, userId),
          eq(pvpMatches.defenderId, userId),
        ),
      ),
    )
    .limit(1);
  const m = rows[0];
  if (!m) return new Response("not found", { status: 404 });

  const iAmAttacker = m.attackerId === userId;
  const opponentId = iAmAttacker ? m.defenderId : m.attackerId;
  // engine 은 attacker=p1, defender=p2 — 사이드는 변동 없음.
  const mySide: "p1" | "p2" = iAmAttacker ? "p1" : "p2";

  // 본인 시점 win/loss/draw + rating before/after.
  let myOutcome: "win" | "loss" | "draw";
  if (m.outcome === "draw") myOutcome = "draw";
  else if (m.outcome === "a_win") myOutcome = iAmAttacker ? "win" : "loss";
  else myOutcome = iAmAttacker ? "loss" : "win";
  const ratingBefore = iAmAttacker
    ? m.attackerRatingBefore
    : m.defenderRatingBefore;
  const ratingAfter = iAmAttacker
    ? m.attackerRatingAfter
    : m.defenderRatingAfter;

  const opponentActor = await resolveActor(opponentId);

  const rawLog = (m.log ?? []) as BattleLogEntry[];

  return Response.json({
    id: m.id,
    createdAt: m.createdAt,
    iAmAttacker,
    opponent: {
      userId: opponentId,
      name: opponentActor.name,
      isBot: isBotId(opponentId),
    },
    myOutcome,
    ratingBefore,
    ratingAfter,
    ratingDelta: ratingAfter - ratingBefore,
    // engine 이 attacker 임에 무관하게 p1 으로 박은 게 아니라, attacker=p1 / defender=p2 컨벤션
    // 그대로. 그래서 iAmAttacker 면 mySide=p1, 아니면 p2.
    log: toMyPerspective(rawLog, mySide),
  });
}
