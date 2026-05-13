"use client";

import { AdventureHome } from "@/adventure/adventureSubViews/AdventureHome";
import { BattleSubView } from "@/adventure/adventureSubViews/BattleSubView";
import { BossSubView } from "@/adventure/adventureSubViews/BossSubView";
import { TownSubView } from "@/adventure/adventureSubViews/TownSubView";
import { MapSubView } from "@/adventure/adventureSubViews/MapSubView";
import { useGame } from "@/adventure/GameContext";

export function AdventureScreen() {
  const { subView } = useGame();

  switch (subView) {
    case null:
      return <AdventureHome />;
    case "town":
      return <TownSubView />;
    case "battle":
      return <BattleSubView />;
    case "boss":
      return <BossSubView />;
    case "map":
      return <MapSubView />;
    default:
      return null;
  }
}
