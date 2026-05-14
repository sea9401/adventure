"use client";

import { TowerPage } from "@/adventure/tower/TowerPage";
import { useGame } from "@/adventure/GameContext";

// AdventureScreen 에서 ?sub=tower 라우팅을 받아 TowerPage 를 렌더링하는 얇은 래퍼.
// CharacterScreen 도 같은 컴포넌트를 직접 import 해서 자기 subView 라우팅에 사용.
export function TowerSubView() {
  const { character, playerStatus, back, characterStateHook } = useGame();
  return (
    <TowerPage
      onBack={back}
      playerName={character.name}
      playerStatus={playerStatus}
      onApplied={(r) => {
        // 마일스톤 보상으로 character.v2 (gold) 가 갱신됐으면 in-memory 도 동기화.
        // 재료 보상은 inventory hook 이 다음 PATCH 에서 자가 수렴(409 재시도).
        if (r.character && typeof r.character.gold === "number") {
          characterStateHook.replaceFromSaved(r.character);
        }
      }}
    />
  );
}
