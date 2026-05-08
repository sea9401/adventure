import type { StatKey } from "@/adventure/data/stats";
import type { Skill } from "./types";

// 강공격 — 힘 10 도달 시 획득.
// 효과: 3턴마다 자동 발동, 그 턴의 첫 공격이 ATK +2 데미지로 나감.
export const POWER_ATTACK_STR_THRESHOLD = 10;
export const POWER_ATTACK_BONUS = 2;
export const POWER_ATTACK_TURN_INTERVAL = 3;

// 현재 스탯에서 보유 스킬 목록 도출. 스킬은 별도 저장 없이 스탯에서 파생.
export function deriveSkills(stats: Record<StatKey, number>): Skill[] {
  const out: Skill[] = [];
  if (stats.str >= POWER_ATTACK_STR_THRESHOLD) {
    out.push({
      name: "강공격",
      description: `${POWER_ATTACK_TURN_INTERVAL}턴마다 자동 발동 — ATK +${POWER_ATTACK_BONUS} 데미지로 공격`,
    });
  }
  return out;
}

// 전투 엔진이 사용할 강공격 보너스 — 미보유면 0.
export function powerAttackBonusFor(stats: Record<StatKey, number>): number {
  return stats.str >= POWER_ATTACK_STR_THRESHOLD ? POWER_ATTACK_BONUS : 0;
}
