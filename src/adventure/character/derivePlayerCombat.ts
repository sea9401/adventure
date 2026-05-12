// 캐릭터 영구 데이터 (저장된 stats / 장비 / 스킬) → 전투 엔진용 PlayerCombat 변환.
// page.tsx (클라이언트) 와 협동 보스 라우트 (서버) 가 공유 — 클라이언트 위변조 차단을 위해
// 서버는 같은 derive 로 재계산해 클라가 보낸 값을 무시한다.

import type { PlayerCombat } from "@/adventure/battle/engine";
import type { EquipItem } from "@/adventure/data/items";
import { STAT_KEYS, type StatKey } from "@/adventure/data/stats";
import { maxHpForLevel } from "./defaults";
import type { Skill } from "./types";
import {
  acrobatEvadeHealFor,
  balanceCritPctPerSpdDiffFor,
  bleedDmgPerStackFor,
  bulwarkShieldFor,
  counterAtkBonusFor,
  critChancePctFor,
  critMultFor,
  crushDefReductionFor,
  deriveFeats,
  deriveSkills,
  doubleLuckBonusesFor,
  doubleStrikeIntervalFor,
  effectiveFeatName,
  effectiveSkillNames,
  enduranceActiveFor,
  enduranceMaxHpBonusPctFor,
  evadeBonusPctFor,
  evadeGuaranteedFor,
  executionDamageMultFor,
  executionHpFractionFor,
  flurryAttacksFor,
  guardFor,
  heavenDecreeChancePctFor,
  lifestealCritHealPctFor,
  lightspeedExtraAttackPctFor,
  luckyShieldBlockPctFor,
  powerAttackBonusFor,
  precisionEvasionMultFor,
  regenFor,
  shadowCloneAtkPctFor,
  skillLayout,
  vanguardFirstTurnBonusFor,
  type SkillLayout,
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
  /** 장착 스킬 이름 목록 (일반 슬롯). undefined 면 자동 (보유 첫 N개). */
  equippedSkills: string[] | undefined;
  /** 장착 특기 이름 (특기 전용 슬롯). 미장착이면 undefined. */
  equippedFeat?: string;
  /** 보유 스토리 플래그 id 집합 — 슬롯 해금(skillLayout) 판정용. 미지정 = 빈 집합. */
  storyFlagIds?: ReadonlySet<string>;
  /** 현재 hp — 협동 공격 시 시작값. */
  hp: number;
};

export type DerivedPlayerCombat = {
  player: PlayerCombat;
  totalStats: Record<StatKey, number>;
  maxHp: number;
  /** 도감/표시용 보유 스탯 스킬. */
  characterSkills: Skill[];
  /** 도감/표시용 보유 특기. */
  characterFeats: Skill[];
  /** 현재 발동 중인 일반 스킬 이름 (슬롯 한도 반영). */
  effectiveSkillNames: string[];
  /** 현재 발동 중인 특기 이름 (특기 슬롯 닫혀 있거나 미장착이면 null). */
  effectiveFeatName: string | null;
  /** effective 일반 스킬 + 특기를 합친 Set (엔진 합성에 사용). */
  effectiveSkillSet: Set<string>;
  /** 현재 슬롯 레이아웃 (일반 칸 수 / 특기 칸 유무). */
  layout: SkillLayout;
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

  const layout = skillLayout({
    level: input.level,
    hasFlag: (id) => input.storyFlagIds?.has(id) ?? false,
  });
  const characterSkills = deriveSkills(totalStats);
  const characterFeats = deriveFeats(totalStats);
  const effectiveNames = effectiveSkillNames(
    characterSkills,
    input.equippedSkills,
    layout.normalSlots,
  );
  const featName = effectiveFeatName(
    characterFeats,
    input.equippedFeat,
    layout.hasFeatSlot,
  );
  const effectiveSkillSet = new Set(effectiveNames);
  if (featName) effectiveSkillSet.add(featName);

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
    lifestealCritHealPct: lifestealCritHealPctFor(totalStats, effectiveSkillSet),
    evadeHealAmount: acrobatEvadeHealFor(totalStats, effectiveSkillSet),
    balanceCritPctPerSpdDiff: balanceCritPctPerSpdDiffFor(
      totalStats,
      effectiveSkillSet,
    ),
    luckyShieldBlockPct: luckyShieldBlockPctFor(totalStats, effectiveSkillSet),
    bleedDmgPerStack: bleedDmgPerStackFor(totalStats, effectiveSkillSet),
    shadowCloneAtkPct: shadowCloneAtkPctFor(totalStats, effectiveSkillSet),
    bulwarkShield: bulwarkShieldFor(totalStats, effectiveSkillSet),
    flurryAttacks: flurryAttacksFor(totalStats, effectiveSkillSet),
    heavenDecreeChancePct: heavenDecreeChancePctFor(
      totalStats,
      effectiveSkillSet,
    ),
  };

  return {
    player,
    totalStats,
    maxHp,
    characterSkills,
    characterFeats,
    effectiveSkillNames: effectiveNames,
    effectiveFeatName: featName,
    effectiveSkillSet,
    layout,
  };
}
