export type ResourceKind = "gold" | "iron";
export type Resources = Record<ResourceKind, number>;

export type MaterialKind =
  | "slime_jelly"
  | "rat_tail"
  | "wolf_pelt"
  | "bandit_dagger"
  | "goblin_ore"
  | "vein_crystal"
  | "guardian_shard"
  | "necromancer_staff"
  | "desert_silk"
  | "scorpion_sting"
  | "frost_fang"
  | "ice_shard"
  | "slime_king_core"
  | "alpha_wolf_fang"
  | "spider_queen_silk"
  | "dormant_guardian_eye"
  | "giant_scorpion_claw"
  | "frost_giant_heart"
  | "summon_scroll"
  | "san_gun_summon"
  | "mountain_lord_pelt"
  | "griffon_summon"
  | "griffon_feather"
  | "kraken_summon"
  | "kraken_tentacle"
  | "pirate_dagger"
  | "old_telescope"
  | "soul_fragment"
  | "broken_sword"
  | "captain_skull"
  | "ghost_captain_hat"
  | "shadow_fragment"
  | "abyss_stone"
  | "void_essence"
  | "abyss_lord_core";

export type Materials = Partial<Record<MaterialKind, number>>;

export type MaterialDef = {
  id: MaterialKind;
  name: string;
};
