export type CharacterClass = "none" | "warrior" | "rogue" | "mage";

export type AdvancedClassId =
  | "berserker"
  | "paladin"
  | "assassin"
  | "venom_master"
  | "elementalist";

export type ClassPassive =
  | { kind: "damage_reduction"; pct: number }
  | { kind: "crit"; chance: number; mult: number }
  | { kind: "def_pierce"; pct: number }
  // 광전사: 상시 ATK +atkPct, 매 턴 maxHp의 hpDrainPctPerTurn 잃음
  | { kind: "berserker_overdrive"; atkPct: number; hpDrainPctPerTurn: number }
  // 수호기사: 받는 데미지 -reductionPct, 피격 시 DEF×reflectPct 데미지 반사
  | { kind: "shield_reflect"; reductionPct: number; reflectPct: number }
  // 레인저: 자기 SPD 보너스 + 적 SPD 디버프 (전투 동안 영구)
  | { kind: "speed_aura"; spdSelfBonus: number; enemySpdDebuff: number }
  // 원소술사: 마법 데미지 +pct, player turn 시작마다 INT*turnStartIntMult 마력 분출 (자동 마법)
  | { kind: "magic_amp_with_aura"; pct: number; turnStartIntMult: number }
  // 맹독술사: 가하는 도트 데미지 +pct, 독 스택 최대치 +stackCapBonus
  | { kind: "dot_aura"; pct: number; stackCapBonus?: number };

export type ClassDef = {
  id: CharacterClass;
  name: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseMdef: number;
  baseSpd: number;
  baseAgi: number;
  baseInt: number;
  baseStr?: number;
  baseVit?: number;
  baseMatk?: number;
  growHp: number;
  growAtk: number;
  growDef: number;
  growMdef: number;
  growSpd: number;
  growAgi: number;
  growInt: number;
  growStr?: number;
  growVit?: number;
  growMatk?: number;
  // 정체성 자원 → 파생 효과 변환 계수 (모두 옵셔널, 미설정 시 기본 동작 — docs/20)
  strToAtkMult?: number; // 기본 1 — STR 1당 ATK 가산 배수
  vitToDefMult?: number; // 기본 1 — VIT 1당 DEF 가산 배수
  vitToHp?: number; // 기본 0 — VIT 1당 추가 HP
  agiDodgeMult?: number; // 기본 1 — AGI 회피율 배수 (플레이어 한정)
  agiCritMult?: number; // 기본 1 — AGI 크리율 배수 (플레이어 한정)
  matkToIntMult?: number; // 기본 1 — MATK 1당 INT 가산 배수
  passive: ClassPassive;
  passiveText: string;
  flavor: string;
};

// 2차 직업은 1차 직업의 성장률에 비율을 곱해 보정 + 패시브 교체
export type AdvancedClassDef = {
  id: AdvancedClassId;
  parent: CharacterClass;
  name: string;
  // 성장률 배율 (1.0 = 변화 없음, 1.5 = +50%, 0.85 = -15%)
  growMult: {
    hp?: number;
    atk?: number;
    def?: number;
    mdef?: number;
    spd?: number;
    agi?: number;
    int?: number;
    str?: number;
    vit?: number;
    matk?: number;
  };
  // 부모 클래스 성장에 더해지는 절대 보정 (베이스 성장이 0이라 배율로는 효과 없는 경우용)
  growBonus?: {
    hp?: number;
    atk?: number;
    def?: number;
    mdef?: number;
    spd?: number;
    agi?: number;
    int?: number;
    str?: number;
    vit?: number;
    matk?: number;
  };
  passive: ClassPassive;
  passiveText: string;
  flavor: string;
};
