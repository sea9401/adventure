// 캐릭터 영구 데이터 + 장비 + 스킬 + 프로필 → 전투/렌더 양쪽에서 쓰는 합성 결과.
//
// page.tsx 가 1) PlayerCombat (전투 엔진용) 과 2) Character (UI 렌더용) 를 모두 만들 때
// 인라인으로 같은 계산(장비/스탯/스킬/HP 합산)을 두 번 하던 것을 한 번으로 통합한다.
// derivePlayerCombat 의 단일 source-of-truth 를 그대로 재사용 — 서버 협동보스도 같은
// 함수를 통해 일관된 수치를 얻는다.
//
// 순수 함수 — hook 아님. 매 render 호출되지만 derivePlayerCombat 비용은 무시 가능.

import { requiredExpToNext } from "@/lib/leveling";
import type { Gender } from "@/adventure/profile/avatars";
import { baseCharacter, maxMpForLevel } from "./defaults";
import {
  derivePlayerCombat,
  type DerivePlayerCombatInput,
  type DerivedPlayerCombat,
} from "./derivePlayerCombat";
import { deriveSkills, effectiveSkillNames } from "./skills";
import type { Character, EquippedSlots, Skill } from "./types";

export type ComposeCharacterInput = DerivePlayerCombatInput & {
  name: string;
  gender: Gender;
  /** 저장된 mp — maxMp 로 clamp 된다. */
  mp: number;
  exp: number;
  gold: number;
  fame: number;
  /** UI 표시용 — 누적 처치 + 패배. */
  battleCount: number;
  /** 장착 중인 칭호 이름 (TITLES[id].name). 미장착이면 undefined. */
  titleName: string | undefined;
  affiliation?: string;
};

export type ComposedCharacter = DerivedPlayerCombat & {
  /** UI 렌더용 캐릭터. */
  character: Character;
  /** 도감/툴팁/표시용 모든 보유 스킬 (효과 발동 여부 무관). */
  characterSkills: Skill[];
  /** 현재 발동 중인 스킬 이름 — playerCombat 에 반영된 것만. */
  effectiveSkillNames: string[];
  /** 위와 동일을 Set 으로. */
  effectiveSkillSet: Set<string>;
  /** UI 헤더/장비 화면 등이 그대로 쓰는 장착 슬롯 사본. */
  equippedSlots: EquippedSlots;
};

export function composeCharacter(
  input: ComposeCharacterInput,
): ComposedCharacter {
  const combat = derivePlayerCombat(input);
  const { totalStats, maxHp } = combat;

  const characterSkills = deriveSkills(totalStats);
  const effective = effectiveSkillNames(characterSkills, input.equippedSkills);
  const effectiveSkillSet = new Set(effective);

  const maxMp = maxMpForLevel(input.level);

  const equippedSlots: EquippedSlots = {
    weapon: input.equipped.weapon,
    armor: input.equipped.armor,
    accessory: input.equipped.accessory,
  };

  const character: Character = {
    ...baseCharacter,
    name: input.name,
    gender: input.gender,
    titleName: input.titleName,
    hp: combat.player.hp,
    mp: Math.min(input.mp, maxMp),
    maxHp,
    maxMp,
    level: input.level,
    exp: input.exp,
    maxExp: requiredExpToNext(input.level) ?? 0,
    gold: input.gold,
    fame: input.fame,
    battleCount: input.battleCount,
    equipped: equippedSlots,
    stats: totalStats,
    skills: characterSkills,
    affiliation: input.affiliation ?? baseCharacter.affiliation,
  };

  return {
    ...combat,
    character,
    characterSkills,
    effectiveSkillNames: effective,
    effectiveSkillSet,
    equippedSlots,
  };
}
