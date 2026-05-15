import type { ReactNode } from "react";
import { OverviewContent } from "./overview";
import { ControlsContent } from "./controls";
import { CombatContent } from "./combat";
import { StatsContent } from "./stats";
import { SkillsContent } from "./skills";
import { LevelingContent } from "./leveling";
import { EquipmentContent } from "./equipment";
import { RunesContent } from "./runes";
import { PotionsContent } from "./potions";
import { HuntingContent } from "./hunting";
import { TownContent } from "./town";
import { QuestsContent } from "./quests";
import { CompendiumContent } from "./compendium";
import { TowerContent } from "./tower";

// 슬러그 → 그 섹션의 본문 컴포넌트.
export const MANUAL_CONTENT: Record<string, () => ReactNode> = {
  overview: OverviewContent,
  controls: ControlsContent,
  combat: CombatContent,
  stats: StatsContent,
  skills: SkillsContent,
  leveling: LevelingContent,
  equipment: EquipmentContent,
  runes: RunesContent,
  potions: PotionsContent,
  hunting: HuntingContent,
  town: TownContent,
  quests: QuestsContent,
  compendium: CompendiumContent,
  tower: TowerContent,
};
