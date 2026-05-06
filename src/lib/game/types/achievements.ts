import type { Materials } from "./primitives";
import type { GameStats } from "./state";

export type AchievementId =
  | "first_dispatch"
  | "first_boss"
  | "first_craft"
  | "all_field_bosses"
  | "all_classes"
  | "slime_kills"
  | "wolf_chief_kills"
  | "spider_queen_kills"
  | "guardian_kills"
  | "scorpion_kills"
  | "frost_giant_kills"
  | "pirate_captain_kills"
  | "ghost_captain_kills"
  | "san_gun_kills"
  | "griffon_kills"
  | "kraken_kills"
  | "total_kills"
  | "total_gold"
  | "total_iron"
  | "level_progress"
  | "abyss_kills";

export type AchievementCategory = "first" | "combat" | "boss" | "etc";

export type AchievementReward = {
  gold?: number;
  iron?: number;
  materials?: Materials;
};

export type SingleAchievementDef = {
  kind: "single";
  id: AchievementId;
  name: string;
  description: string;
  category: AchievementCategory;
  reward: AchievementReward;
  check: (stats: GameStats) => boolean;
  progress?: (stats: GameStats) => { current: number; goal: number };
};

export type AchievementTier = {
  goal: number;
  suffix: string;
  reward: AchievementReward;
};

export type TieredAchievementDef = {
  kind: "tiered";
  id: AchievementId;
  name: string; // 베이스 이름 (예: "슬라임")
  category: AchievementCategory;
  metric: (stats: GameStats) => number;
  tiers: AchievementTier[];
};

export type AchievementDef = SingleAchievementDef | TieredAchievementDef;
