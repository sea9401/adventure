// POST /api/pvp/challenge
//
// 비동기 PvP 도전 — 1 호출 = 1 매치.
//
//   1) 시즌 확보 (없으면 생성, 만료 시즌 자동 닫힘은 cron 책임)
//   2) 내 캐릭터 derive — 없으면 400
//   3) 내 레이팅 row 확보 (없으면 ELO_INITIAL)
//   4) 매칭 풀에서 상대 1명 (Elo±200→500→1000→전체)
//   5) 상대 캐릭터 derive — 풀 fetch 후 save 가 사라졌다면 race → 503
//   6) 상대 레이팅 row 확보
//   7) resolveBattlePvP — 양쪽 자동 평타 (포션/전략 결정은 후속 PR)
//   8) outcome → a_win/d_win/draw 매핑, recordMatchAndUpdateRatings 트랜잭션
//   9) 응답: { outcome, me, opponent, turns, log }
//
// 보상 화폐 / 일일 캡 / 봇 fallback / rate limit 은 후속 PR 범위.

import { ensureUser } from "@/lib/server/ensureUser";
import { derivePlayerCombatFromSaves } from "@/lib/server/derivePlayerCombatFromSaves";
import { resolveActor } from "@/lib/server/resolveActor";
import { getOrCreateCurrentSeason } from "@/lib/server/pvp/season";
import {
  getOrCreateRating,
  recordMatchAndUpdateRatings,
} from "@/lib/server/pvp/ratings";
import { pickOpponent } from "@/lib/server/pvp/matching";
import { resolveBattlePvP } from "@/adventure/battle/engine-pvp";
import type { PvPOutcome } from "@/adventure/battle/engine-pvp";

type DbOutcome = "a_win" | "d_win" | "draw";

function pvpToDbOutcome(o: PvPOutcome): DbOutcome {
  switch (o) {
    case "p1_win":
      return "a_win";
    case "p2_win":
      return "d_win";
    case "draw":
      return "draw";
  }
}

export async function POST() {
  const userId = await ensureUser();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const season = await getOrCreateCurrentSeason();

  const myCombat = await derivePlayerCombatFromSaves(userId);
  if (!myCombat) {
    return new Response("character not found", { status: 400 });
  }

  const myRating = await getOrCreateRating(userId, season.id);

  const opponent = await pickOpponent({
    selfId: userId,
    myRating: myRating.rating,
    seasonId: season.id,
  });
  if (!opponent) {
    return new Response("no opponents available", { status: 503 });
  }

  const oppCombat = await derivePlayerCombatFromSaves(opponent.userId);
  if (!oppCombat) {
    // 풀 fetch 와 derive 사이에 save 가 사라진 race — 다음 호출에서 풀이 갱신됨.
    return new Response("opponent unavailable", { status: 503 });
  }

  await getOrCreateRating(opponent.userId, season.id);

  const [meActor, oppActor] = await Promise.all([
    resolveActor(userId),
    resolveActor(opponent.userId),
  ]);

  // MVP 자동전투 — 평타만. 포션/전략 발동은 후속 PR.
  const resolution = resolveBattlePvP(
    myCombat.player,
    oppCombat.player,
    meActor.name,
    oppActor.name,
    {
      pickAction: () => ({ kind: "attack" }),
      potions: { p1: {}, p2: {} },
    },
  );

  const dbOutcome = pvpToDbOutcome(resolution.outcome);

  const { attackerAfter, defenderAfter } = await recordMatchAndUpdateRatings({
    seasonId: season.id,
    attackerId: userId,
    defenderId: opponent.userId,
    outcome: dbOutcome,
    log: resolution.finalState.log,
  });

  return Response.json({
    seasonId: season.id,
    outcome: dbOutcome,
    turns: resolution.turns,
    me: {
      name: meActor.name,
      ratingBefore: myRating.rating,
      ratingAfter: attackerAfter,
    },
    opponent: {
      userId: opponent.userId,
      name: oppActor.name,
      ratingBefore: opponent.rating,
      ratingAfter: defenderAfter,
    },
    log: resolution.finalState.log,
  });
}
