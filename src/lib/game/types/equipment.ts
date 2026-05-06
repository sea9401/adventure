import type { Materials } from "./primitives";

export type EquipmentSlot = "head" | "body" | "gloves" | "boots" | "weapon" | "ring";

export type EquipmentBonus = {
  hp?: number;
  atk?: number;
  def?: number;
  mdef?: number;
  spd?: number;
  agi?: number;
  int?: number;
  str?: number; // primary attribute — 캐릭터 STR로 누적 (직업 strToAtkMult 적용)
  vit?: number; // primary attribute — 캐릭터 VIT로 누적 (직업 vitToDefMult/vitToHp 적용)
  matk?: number; // primary attribute — 캐릭터 MATK로 누적 (직업 matkToIntMult 적용)
  crit?: number; // 0~1 (0.05 = +5% 크리티컬 확률)
  dotAmp?: number; // 0~1 (0.10 = +10% DOT 증폭, dot_aura passive와 가산)
};

export type EquipmentId =
  | "slime_hood"
  | "rat_boots"
  | "leather_armor"
  | "leather_gloves"
  | "leather_boots"
  | "bandit_dagger_eq"
  | "crystal_armor"
  | "spider_gloves"
  | "miner_boots"
  | "spirit_staff"
  | "guardian_helm"
  | "wraith_robe"
  | "ruin_gloves"
  | "guardian_boots"
  | "guardian_sword"
  | "desert_hood"
  | "desert_armor"
  | "desert_gloves"
  | "sand_boots"
  | "desert_blade"
  | "frost_helm"
  | "glacier_armor"
  | "ice_gloves"
  | "glacier_boots"
  | "glacier_blade"
  | "pirate_hood"
  | "pirate_boots"
  | "ghost_helm"
  | "ghost_armor"
  | "ghost_gloves"
  | "ghost_boots"
  | "ghost_blade"
  | "griffon_helm"
  | "griffon_armor"
  | "griffon_gloves"
  | "griffon_boots"
  | "griffon_talon"
  | "slime_crown"
  | "slime_core_staff"
  | "bouncy_boots"
  | "alpha_fang_dagger"
  | "wolf_hood"
  | "stalker_boots"
  | "spider_queen_robe"
  | "fang_gloves"
  | "spider_silk_venomfang"
  | "guardian_greatshield"
  | "guardian_plate"
  | "slime_king_ring"
  | "alpha_wolf_ring"
  | "spider_queen_ring"
  | "guardian_ring"
  // 보스 유니크 드랍 (제작 불가, 각 보스 1종)
  | "slime_emperor_plate"
  | "alpha_claw_gloves"
  | "spider_queen_signet"
  | "guardian_crown"
  | "scorpion_thorn_boots"
  | "frost_lord_mantle"
  | "captain_excalibur"
  | "ghost_captain_signet"
  | "abyss_mask"
  | "rift_warden_gloves"
  | "abyss_lord_scepter";

export type EquipmentDef = {
  id: EquipmentId;
  name: string;
  slot: EquipmentSlot;
  cost: Materials;
  bonus: EquipmentBonus;
  setId?: SetId;
  // 보스 고유 장비 그룹명. 세트가 아닌 단일 보스 드랍 장비를 묶는 라벨 (예: "슬라임 왕")
  bossLabel?: string;
  // 제작 불가 — 보스 처치 시 확률 드랍으로만 획득
  dropOnly?: boolean;
  flavor: string;
};

export type SetId =
  | "plains_set"
  | "forest_set"
  | "cave_set"
  | "ruins_set"
  | "desert_set"
  | "snow_set"
  | "pirate_set"
  | "ghost_set"
  | "griffon_set";

export type SetTier = {
  count: number;
  bonus: EquipmentBonus;
};

export type SetDef = {
  id: SetId;
  name: string;
  totalPieces: number;
  tiers: SetTier[];
};

export type EquippedItems = Partial<Record<EquipmentSlot, EquipmentId>>;
