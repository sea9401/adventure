export type EquipBonus = {
  atk?: number;
  def?: number;
};

export type EquipItem = {
  name: string;
  stats: { label: string; value: string }[];
  bonus?: EquipBonus;
  description?: string;
};

export const ITEMS = {
  baseball_bat: {
    name: "야구 방망이",
    stats: [{ label: "공격력", value: "+2" }],
    bonus: { atk: 2 },
    description: "단단한 나무를 깎아 만든 묵직한 방망이.",
  } satisfies EquipItem,
  old_leather_armor: {
    name: "낡은 가죽갑옷",
    stats: [{ label: "방어력", value: "+2" }],
    bonus: { def: 2 },
    description: "오랜 세월 입던 흔적이 남아있지만 천 옷보단 든든하다.",
  } satisfies EquipItem,
} as const;

export type ItemId = keyof typeof ITEMS;
