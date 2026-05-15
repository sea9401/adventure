// 룬 시스템 PR-A — 가산형 7종 × 5등급. 슬롯 3개 (CharacterDynamicState.equippedRunes).
//
// 효과는 derivePlayerCombat (ATK/DEF/HP/CRIT) / onBattleEnd (EXP/드롭) /
// battle engine (포션) 에서 등급 magnitude 를 합산해 적용.
//
// proc/trigger 류 (반격·흡혈·재생) 는 전투 엔진 hook 필요 → PR-B 에서 추가.

export type RuneGrade = 1 | 2 | 3 | 4 | 5;
export const RUNE_GRADES: readonly RuneGrade[] = [1, 2, 3, 4, 5] as const;

// 효과 종류 — 가산 7개 + proc/trigger 3개. 모두 % 단위로 보너스 합산 후 적용.
// rune.effect 는 ID 가 아닌 효과 카테고리 — 같은 카테고리 룬을 여러 슬롯에 끼면 합산된다.
export type RuneEffectKind =
  | "atk_pct" // ATK 가산 %
  | "def_pct" // DEF 가산 %
  | "hp_pct" // 최대 HP 가산 %
  | "crit_pct" // 치명타 확률 가산 %
  | "exp_pct" // 획득 EXP 가산 %
  | "drop_pct" // 드롭률 가산 %
  | "potion_pct" // 포션 회복량 가산 %
  | "counter_pct" // 피격 시 ATK 반격 발동 확률 %
  | "lifesteal_pct" // 명중 시 가한 피해의 % 만큼 HP 회복
  | "regen_pct"; // 전투 승리 시 최대 HP 의 % 만큼 회복

export type RuneFamily = "combat" | "resource";

export type RuneId =
  | "rune_attack"
  | "rune_guard"
  | "rune_life"
  | "rune_crit"
  | "rune_training"
  | "rune_fortune"
  | "rune_alchemy"
  | "rune_counter"
  | "rune_lifesteal"
  | "rune_regen";

export type RuneDef = {
  id: RuneId;
  name: string;
  family: RuneFamily;
  effect: RuneEffectKind;
  description: string;
  /** 등급별 magnitude (% 가산값). RUNE_GRADES 순서. */
  magnitudeByGrade: Record<RuneGrade, number>;
};

// 가산형 평탄 — ATK/DEF/HP%, CRIT%
const FLAT_PCT: Record<RuneGrade, number> = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 };
// 자원형 — EXP/드롭/포션% (단련 포인트 인플레이션 안 건드리도록 약간 더 후함)
const RESOURCE_PCT: Record<RuneGrade, number> = {
  1: 5,
  2: 10,
  3: 15,
  4: 20,
  5: 30,
};
// proc — 반격/흡혈 발동 빈도. FLAT 보다 살짝 높게 (한 슬롯만으로도 체감 가능하도록).
const PROC_PCT: Record<RuneGrade, number> = { 1: 3, 2: 6, 3: 9, 4: 12, 5: 15 };
// 재생 — 전투 후 HP 회복 %. 자동 사냥 휴식 무력화 방지 위해 가장 작게.
const REGEN_PCT: Record<RuneGrade, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };

export const RUNES: Record<RuneId, RuneDef> = {
  rune_attack: {
    id: "rune_attack",
    name: "공격의 룬",
    family: "combat",
    effect: "atk_pct",
    description: "장착 시 공격력이 일정 %만큼 증가한다.",
    magnitudeByGrade: FLAT_PCT,
  },
  rune_guard: {
    id: "rune_guard",
    name: "수호의 룬",
    family: "combat",
    effect: "def_pct",
    description: "장착 시 방어력이 일정 %만큼 증가한다.",
    magnitudeByGrade: FLAT_PCT,
  },
  rune_life: {
    id: "rune_life",
    name: "생명의 룬",
    family: "combat",
    effect: "hp_pct",
    description: "장착 시 최대 HP가 일정 %만큼 증가한다.",
    magnitudeByGrade: FLAT_PCT,
  },
  rune_crit: {
    id: "rune_crit",
    name: "치명타의 룬",
    family: "combat",
    effect: "crit_pct",
    description: "장착 시 치명타 확률이 일정 %만큼 증가한다.",
    magnitudeByGrade: FLAT_PCT,
  },
  rune_training: {
    id: "rune_training",
    name: "수련의 룬",
    family: "resource",
    effect: "exp_pct",
    description: "전투에서 얻는 경험치가 일정 %만큼 증가한다.",
    magnitudeByGrade: RESOURCE_PCT,
  },
  rune_fortune: {
    id: "rune_fortune",
    name: "행운의 룬",
    family: "resource",
    effect: "drop_pct",
    description: "전투 후 아이템 드롭률이 일정 %만큼 증가한다.",
    magnitudeByGrade: RESOURCE_PCT,
  },
  rune_alchemy: {
    id: "rune_alchemy",
    name: "연단의 룬",
    family: "resource",
    effect: "potion_pct",
    description: "포션의 회복량이 일정 %만큼 증가한다.",
    magnitudeByGrade: RESOURCE_PCT,
  },
  rune_counter: {
    id: "rune_counter",
    name: "반격의 룬",
    family: "combat",
    effect: "counter_pct",
    description: "피격 시 일정 확률로 적에게 ATK 만큼 반격한다.",
    magnitudeByGrade: PROC_PCT,
  },
  rune_lifesteal: {
    id: "rune_lifesteal",
    name: "흡혈의 룬",
    family: "combat",
    effect: "lifesteal_pct",
    description: "명중한 공격이 가한 피해의 일정 % 만큼 HP를 회복한다.",
    magnitudeByGrade: PROC_PCT,
  },
  rune_regen: {
    id: "rune_regen",
    name: "재생의 룬",
    family: "combat",
    effect: "regen_pct",
    description: "전투 승리 직후 최대 HP의 일정 %만큼 회복한다.",
    magnitudeByGrade: REGEN_PCT,
  },
};

export const RUNE_IDS: readonly RuneId[] = Object.keys(RUNES) as RuneId[];

export const RUNE_SLOT_COUNT = 3;

export type EquippedRune = {
  id: RuneId;
  grade: RuneGrade;
};

export function getRuneMagnitude(id: RuneId, grade: RuneGrade): number {
  return RUNES[id].magnitudeByGrade[grade];
}

export function isRuneId(v: string): v is RuneId {
  return v in RUNES;
}

export function isRuneGrade(n: number): n is RuneGrade {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}
