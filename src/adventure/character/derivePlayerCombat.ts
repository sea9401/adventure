// 캐릭터 영구 데이터 (저장된 stats / 장비 / 스킬) → 전투 엔진용 PlayerCombat 변환.
// page.tsx (클라이언트) 와 협동 보스 라우트 (서버) 가 공유 — 클라이언트 위변조 차단을 위해
// 서버는 같은 derive 로 재계산해 클라가 보낸 값을 무시한다.

import type { PlayerCombat } from "@/adventure/battle/engine";
import type { EquipItem } from "@/adventure/data/items";
import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import { maxHpForLevel } from "./defaults";
import {
  counterAtkBonusFor,
  critChancePctFor,
  critMultFor,
  crushDefReductionFor,
  deriveSkills,
  doubleLuckBonusesFor,
  doubleStrikeIntervalFor,
  effectiveSkillNames,
  enduranceActiveFor,
  enduranceMaxHpBonusPctFor,
  evadeBonusPctFor,
  evadeGuaranteedFor,
  executionDamageMultFor,
  executionHpFractionFor,
  guardFor,
  lightspeedExtraAttackPctFor,
  powerAttackBonusFor,
  precisionEvasionMultFor,
  regenFor,
  vanguardFirstTurnBonusFor,
} from "./skills";

export type DerivePlayerCombatInput = {
  level: number;
  /** 캐릭터 base 스탯 (baseCharacter.stats 와 같은 형태). */
  baseStats: Record<StatKey, number>;
  /** training.v2 의 allocated. */
  allocatedStats: Record<StatKey, number>;
  /** 장착 슬롯 — 무기/방어구/장신구. null 슬롯은 무시. */
  equipped: {
    weapon: EquipItem | null;
    armor: EquipItem | null;
    accessory: EquipItem | null;
  };
  /** 장착 스킬 이름 목록. undefined 면 자동 (보유 첫 N개). */
  equippedSkills: string[] | undefined;
  /** 현재 hp — 협동 공격 시 시작값. */
  hp: number;
};

export type DerivedPlayerCombat = {
  player: PlayerCombat;
  totalStats: Record<StatKey, number>;
  maxHp: number;
};

/**
 * 페이지 렌더링과 서버 시뮬이 동일한 결과를 내도록 보장하는 단일 source-of-truth.
 * 변경 시 page.tsx 의 playerCombat 빌드 코드와 동기화 필수.
 */
export function derivePlayerCombat(
  input: DerivePlayerCombatInput,
): DerivedPlayerCombat {
  // 장비 stat 보너스 합산.
  const equipStatBonuses: Record<StatKey, number> = {
    str: 0,
    dex: 0,
    vit: 0,
    spd: 0,
    luk: 0,
  };
  const items: (EquipItem | null)[] = [
    input.equipped.weapon,
    input.equipped.armor,
    input.equipped.accessory,
  ];
  for (const item of items) {
    if (!item?.bonus) continue;
    for (const k of STAT_KEYS) {
      equipStatBonuses[k] += item.bonus[k] ?? 0;
    }
  }

  const totalStats: Record<StatKey, number> = STAT_KEYS.reduce(
    (acc, k) => {
      acc[k] =
        (input.baseStats[k] ?? 0) +
        (input.allocatedStats[k] ?? 0) +
        equipStatBonuses[k];
      return acc;
    },
    { str: 0, dex: 0, vit: 0, spd: 0, luk: 0 } as Record<StatKey, number>,
  );

  const characterSkills = deriveSkills(totalStats);
  const effectiveSkillSet = new Set(
    effectiveSkillNames(characterSkills, input.equippedSkills),
  );

  // VIT 1pt 당 maxHp +2, 불굴 장착 시 +N%.
  const enduranceHpBonusPct = enduranceMaxHpBonusPctFor(
    totalStats,
    effectiveSkillSet,
  );
  const maxHp = Math.floor(
    (maxHpForLevel(input.level) + totalStats.vit * 2) *
      (1 + enduranceHpBonusPct / 100),
  );

  // 장비 atk/def 합산.
  const equipAtk = items.reduce(
    (sum, item) => sum + (item?.bonus?.atk ?? 0),
    0,
  );
  const equipDef = items.reduce(
    (sum, item) => sum + (item?.bonus?.def ?? 0),
    0,
  );
  const playerDef = totalStats.vit + equipDef;

  const player: PlayerCombat = {
    hp: Math.max(0, Math.min(input.hp, maxHp)),
    maxHp,
    atk:
      totalStats.str +
      Math.floor(totalStats.dex / 5) +
      Math.floor(playerDef / 5) +
      Math.floor(totalStats.luk / 5) +
      Math.floor(totalStats.spd / 5) +
      equipAtk,
    def: playerDef,
    spd: totalStats.spd,
    evasionPct:
      totalStats.dex * 0.5 + evadeBonusPctFor(totalStats, effectiveSkillSet),
    attackCount: 1,
    extraAttackChancePct: Math.min(100, totalStats.spd * 2.5),
    powerAttackBonus: powerAttackBonusFor(totalStats, effectiveSkillSet),
    crushDefReduction: crushDefReductionFor(totalStats, effectiveSkillSet),
    guaranteedEvades: evadeGuaranteedFor(totalStats, effectiveSkillSet),
    counterAtkBonus: counterAtkBonusFor(totalStats, effectiveSkillSet),
    extraAttackEveryNTurns: doubleStrikeIntervalFor(
      totalStats,
      effectiveSkillSet,
    ),
    vanguardFirstTurnBonus: vanguardFirstTurnBonusFor(
      totalStats,
      effectiveSkillSet,
    ),
    critChancePct: critChancePctFor(totalStats, effectiveSkillSet),
    critMult: critMultFor(totalStats, effectiveSkillSet),
    doubleLuck: doubleLuckBonusesFor(totalStats, effectiveSkillSet),
    guard: guardFor(totalStats, effectiveSkillSet),
    regen: regenFor(totalStats, effectiveSkillSet),
    executionDamageMult: executionDamageMultFor(totalStats, effectiveSkillSet),
    executionHpFraction: executionHpFractionFor(totalStats, effectiveSkillSet),
    precisionEvasionMult: precisionEvasionMultFor(
      totalStats,
      effectiveSkillSet,
    ),
    enduranceActive: enduranceActiveFor(totalStats, effectiveSkillSet),
    lightspeedExtraAttackPct: lightspeedExtraAttackPctFor(
      totalStats,
      effectiveSkillSet,
    ),
  };

  return { player, totalStats, maxHp };
}
