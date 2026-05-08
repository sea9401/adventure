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
  dex: "1pt 당 회피 +1%",
  vit: "1pt 당 방어력 +2",
  spd: "10pt 당 공격 횟수 +1 (베이스 1회)",
  luk: "1pt 당 드랍률 +1% (드랍 시스템 도입 시 사용)",
};

// 도감에서 환산 정보를 공개하는 임계값.
export const STAT_REVEAL_THRESHOLD = 20;
