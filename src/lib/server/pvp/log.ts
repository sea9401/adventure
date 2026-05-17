// PvP 전투 로그 관점 변환.
//
// engine-pvp 는 모든 공격을 `player_attack` 으로 박고 `side: "p1"|"p2"` 만 태깅한다 (대칭).
// 클라 BattleLogList 는 player_attack=좌(녹) / enemy_attack=우(적) 라는 비대칭 UI.
// 따라서 "지금 보는 사람" 이 어느 사이드인지에 맞춰 entry 의 kind/turn 을 재매핑.
//
// 호출처:
//   - POST /api/pvp/challenge — 챌린저(=공격자) 가 p1. mySide="p1".
//   - GET  /api/pvp/matches/[id] — 호출자가 attacker 였으면 p1, defender 였으면 p2.
//
// side 가 없는 entry (도입부 info) 는 그대로 — 가운데 정렬 렌더.

import type { BattleLogEntry } from "@/adventure/battle/engine";

export function toMyPerspective(
  log: BattleLogEntry[],
  mySide: "p1" | "p2",
): BattleLogEntry[] {
  const oppSide = mySide === "p1" ? "p2" : "p1";
  return log.map((e) => {
    if (!e.side) return e;
    const turn: "player" | "enemy" = e.side === mySide ? "player" : "enemy";
    if (e.kind === "player_attack" && e.side === oppSide) {
      return { ...e, kind: "enemy_attack", turn };
    }
    return { ...e, turn };
  });
}
