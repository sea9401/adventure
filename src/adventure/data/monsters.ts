export type Monster = {
  name: string;
  image?: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  exp: number;
  gold: number;
};

export const MONSTERS: Record<string, Monster> = {
  주정뱅이: {
    name: "주정뱅이",
    image: "/images/monster/hobo.png",
    hp: 8,
    atk: 1,
    def: 0,
    spd: 1,
    exp: 3,
    gold: 1,
  },
  슬라임: {
    name: "슬라임",
    image: "/images/monster/slime.png",
    hp: 12,
    atk: 2,
    def: 1,
    spd: 1,
    exp: 5,
    gold: 2,
  },
  들개: {
    name: "들개",
    image: "/images/monster/wilddog.png",
    hp: 14,
    atk: 3,
    def: 1,
    spd: 4,
    exp: 6,
    gold: 2,
  },
  두더쥐: {
    name: "두더쥐",
    image: "/images/monster/mole.png",
    hp: 10,
    atk: 2,
    def: 0,
    spd: 3,
    exp: 4,
    gold: 2,
  },
  박쥐: {
    name: "박쥐",
    hp: 14,
    atk: 4,
    def: 0,
    spd: 6,
    exp: 8,
    gold: 3,
  },
  "광맥 골렘": {
    name: "광맥 골렘",
    hp: 30,
    atk: 5,
    def: 4,
    spd: 1,
    exp: 14,
    gold: 6,
  },
  거미: {
    name: "거미",
    hp: 18,
    atk: 5,
    def: 1,
    spd: 5,
    exp: 10,
    gold: 4,
  },
  산적: {
    name: "산적",
    hp: 25,
    atk: 6,
    def: 2,
    spd: 4,
    exp: 12,
    gold: 8,
  },
  "호수 정령": {
    name: "호수 정령",
    hp: 35,
    atk: 8,
    def: 3,
    spd: 4,
    exp: 18,
    gold: 7,
  },
  수룡: {
    name: "수룡",
    hp: 60,
    atk: 10,
    def: 5,
    spd: 5,
    exp: 30,
    gold: 15,
  },
  "고대 망령": {
    name: "고대 망령",
    hp: 50,
    atk: 11,
    def: 4,
    spd: 4,
    exp: 25,
    gold: 10,
  },
  "타락한 기사": {
    name: "타락한 기사",
    hp: 70,
    atk: 13,
    def: 8,
    spd: 3,
    exp: 40,
    gold: 20,
  },
};
