"use client";

import { TowerPage } from "@/adventure/tower/TowerPage";
import { useGame } from "@/adventure/GameContext";

// AdventureScreen 에서 ?sub=tower 라우팅을 받아 TowerPage 를 렌더링하는 얇은 래퍼.
// CharacterScreen 도 같은 컴포넌트를 직접 import 해서 자기 subView 라우팅에 사용.
export function TowerSubView() {
  const { character, playerStatus, back, characterStateHook, inventory } =
    useGame();
  return (
    <TowerPage
      onBack={back}
      playerName={character.name}
      playerStatus={playerStatus}
      onApplied={(r) => {
        // 서버가 character.v2 / inventory.v2 를 read-modify-write 했으므로 응답으로 받은
        // 값을 in-memory 에 통째 교체. 누락하면 다음 로컬 PATCH 의 last-writer-wins 로
        // 룬·재료 보상이 덮여 사라진다 (상점/제작과 동일 패턴).
        if (r.character && typeof r.character.gold === "number") {
          characterStateHook.replaceFromSaved(r.character);
        }
        if (r.inventory) {
          inventory.replaceFromSaved(r.inventory);
        }
      }}
    />
  );
}
