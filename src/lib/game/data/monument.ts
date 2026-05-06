export const MONUMENT_KILL_CAP = 100;
export const MONUMENT_MAX_LEVEL = 25;
export const MONUMENT_LEVEL_FACTOR = (lv: number) => lv * 0.05;
export type MonumentTrophy = {
  bossName: string;
  perKill: Partial<
    Record<"hp" | "atk" | "def" | "mdef" | "spd" | "agi" | "int" | "str" | "vit" | "matk", number>
  >;
};
// 보스 트로피는 primary attribute (STR/VIT/MATK)에 부여 → ATK/DEF/INT로 자동 환산.
export const MONUMENT_TROPHIES: MonumentTrophy[] = [
  { bossName: "거대 슬라임 왕", perKill: { hp: 1 } },
  { bossName: "늑대 우두머리", perKill: { spd: 0.05 } },
  { bossName: "거미 여왕", perKill: { str: 0.5 } },
  { bossName: "잠든 가디언", perKill: { vit: 0.5 } },
  { bossName: "거대 전갈", perKill: { agi: 0.5 } },
  { bossName: "서리 거인", perKill: { hp: 1.5 } },
  { bossName: "해적 선장", perKill: { str: 0.5 } },
  { bossName: "유령 선장", perKill: { matk: 0.5 } },
  { bossName: "심연 감시자", perKill: { agi: 1 } },
  { bossName: "균열의 수호자", perKill: { vit: 1 } },
  { bossName: "심연의 군주", perKill: { str: 1, vit: 1 } },
];
