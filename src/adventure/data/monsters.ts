export type MonsterTag =
  | "humanoid"
  | "beast"
  | "slime"
  | "golem"
  | "spirit"
  | "undead"
  | "dragon";

export type Monster = {
  name: string;
  tags: MonsterTag[];
  image?: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  exp: number;
};

export const MONSTERS: Record<string, Monster> = {
  주정뱅이: {
    name: "주정뱅이",
    tags: ["humanoid"],
    image: "/images/monster/hobo.png",
    hp: 16,
    atk: 1,
    def: 0,
    spd: 1,
    exp: 1,
  },
  슬라임: {
    name: "슬라임",
    tags: ["slime"],
    image: "/images/monster/slime.png",
    hp: 24,
    atk: 2,
    def: 1,
    spd: 1,
    exp: 2,
  },
  들개: {
    name: "들개",
    tags: ["beast"],
    image: "/images/monster/wilddog.png",
    hp: 28,
    atk: 3,
    def: 1,
    spd: 4,
    exp: 3,
  },
  두더쥐: {
    name: "두더쥐",
    tags: ["beast"],
    image: "/images/monster/mole.png",
    hp: 20,
    atk: 2,
    def: 0,
    spd: 3,
    exp: 2,
  },
  박쥐: {
    name: "박쥐",
    tags: ["beast"],
    hp: 28,
    atk: 4,
    def: 0,
    spd: 6,
    exp: 0,
  },
  거미: {
    name: "거미",
    tags: ["beast"],
    hp: 36,
    atk: 5,
    def: 1,
    spd: 5,
    exp: 0,
  },
  산적: {
    name: "산적",
    tags: ["humanoid"],
    hp: 50,
    atk: 6,
    def: 2,
    spd: 4,
    exp: 0,
  },
  "호수 정령": {
    name: "호수 정령",
    tags: ["spirit"],
    hp: 70,
    atk: 8,
    def: 3,
    spd: 4,
    exp: 0,
  },
};

export function getMonstersByTag(tag: MonsterTag): Monster[] {
  return Object.values(MONSTERS).filter((m) => m.tags.includes(tag));
}
