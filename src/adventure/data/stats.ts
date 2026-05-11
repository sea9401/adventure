export const STAT_KEYS = ["str", "dex", "vit", "spd", "luk"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  str: "힘",
  dex: "민첩",
  vit: "활력",
  spd: "속도",
  luk: "행운",
};

// 스탯 1pt 당 전투 수치 환산 — UI 도감 노출용 설명.
export const STAT_CONVERSIONS: Record<StatKey, string> = {
  str: "1pt 당 공격력 +1",
  dex: "1pt 당 회피 +0.5% / 5pt 당 공격력 +1",
  vit: "1pt 당 방어력 +1 / 1pt 당 최대 HP +2 / 방어력 5 당 공격력 +1 (방어구 합산)",
  spd: "1pt 당 추가 공격 확률 +2.5% (매 턴 1회 판정) / 5pt 당 공격력 +1",
  luk: "1pt 당 드랍률 +1% / 1pt 당 크리티컬 확률 +0.5% / 1pt 당 크리티컬 데미지 +0.025배 / 5pt 당 공격력 +1",
};

// 도감에서 스탯별 스킬 정보를 공개하는 임계값.
// 모든 스탯 공통 — 5pt 도달 시 그 스탯이 주는 스킬의 이름·설명이 공개된다.
// (스킬 실제 활성 임계는 스탯별로 다를 수 있음 — skills.ts 의 STAT_SKILL 참조.)
export const STAT_SKILL_INFO_THRESHOLD = 5;

// 도감에서 환산 정보를 공개하는 임계값.
export const STAT_REVEAL_THRESHOLD = 15;

// 3차 스킬 정보를 공개하는 임계값. 활성은 35 — gap 5.
export const STAT_TIER3_REVEAL_THRESHOLD = 30;
