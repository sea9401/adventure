import type { Materials, MaterialKind } from "./primitives";
import type { BossSkillDef } from "./enemies";

export type CoopRewardTier = "bronze" | "silver" | "gold" | "epic" | "legend";

export type CoopTierReward = {
  gold: number;
  iron: number;
  materials: Materials;
};

export type CoopBossDef = {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  mdef: number;
  spd: number;
  agi: number;
  int: number;
  durationSec: number;
  rewardTiers: {
    // 보스 HP 대비 누적 데미지 비율 임계치. 도달한 최고 티어까지의 보상이 누적 지급된다.
    thresholds: Record<CoopRewardTier, number>;
    // 각 티어에서 추가로 지급되는 증분 보상 (누적이 아님).
    rewards: Record<CoopRewardTier, CoopTierReward>;
  };
  summonItem: MaterialKind;
  // 보스 스킬 (선택). 협동 보스는 현재 flat_damage 효과만 지원.
  skill?: BossSkillDef;
  flavor?: string;
};

export type ActiveCoopBoss = {
  sessionId: string;
  bossId: string;
  name: string;
  hp: number;
  maxHp: number;
  contributors: Record<string, { damage: number; attacks: number }>;
  summonedBy: string;
  summonedAt: number;
  expiresAt: number;
  defeated: boolean;
  defeatedAt?: number;
  claimedBy: string[];
};
