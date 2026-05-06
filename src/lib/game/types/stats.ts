export type Stats = {
  maxHp: number;
  atk: number;
  def: number;
  mdef: number;
  spd: number;
  agi: number;
  int: number;
  // Primary attributes — 데미지/방어에 가산되는 속성치
  str: number; // ATK에 더함
  vit: number; // DEF에 더함 (받는 데미지 계산 시)
  matk: number; // INT에 더함 (마법 데미지 계산 시)
};
