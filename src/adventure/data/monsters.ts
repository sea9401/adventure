import type { MaterialId } from "./materials";

export type MonsterTag =
  | "humanoid"
  | "beast"
  | "slime"
  | "golem"
  | "spirit"
  | "undead"
  | "dragon";

export type MonsterDrop = {
  materialId: MaterialId;
  chance: number; // 0~1
};

export type Monster = {
  name: string;
  tags: MonsterTag[];
  image?: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  exp: number;
  drops?: MonsterDrop[];
};

export const MONSTERS: Record<string, Monster> = {
  주정뱅이: {
    name: "주정뱅이",
    tags: ["humanoid"],
    image: "/images/monster/hobo.webp",
    hp: 17,
    atk: 1,
    def: 0,
    spd: 1,
    exp: 1,
  },
  슬라임: {
    name: "슬라임",
    tags: ["slime"],
    image: "/images/monster/slime.webp",
    hp: 25,
    atk: 2,
    def: 1,
    spd: 1,
    exp: 2,
    drops: [
      { materialId: "slime_chunk", chance: 0.15 },
      { materialId: "slime_core", chance: 0.01 },
    ],
  },
  들개: {
    name: "들개",
    tags: ["beast"],
    image: "/images/monster/wilddog.webp",
    hp: 29,
    atk: 3,
    def: 1,
    spd: 4,
    exp: 3,
  },
  두더쥐: {
    name: "두더쥐",
    tags: ["beast"],
    image: "/images/monster/mole.webp",
    hp: 21,
    atk: 2,
    def: 0,
    spd: 3,
    exp: 2,
  },
  박쥐: {
    name: "박쥐",
    tags: ["beast"],
    image: "/images/monster/bat.webp",
    hp: 38,
    atk: 5,
    def: 2,
    spd: 7,
    exp: 4,
  },
  동굴뱀: {
    name: "동굴뱀",
    tags: ["beast"],
    image: "/images/monster/cavesnake.webp",
    hp: 44,
    atk: 6,
    def: 2,
    spd: 5,
    exp: 5,
  },
  거미: {
    name: "거미",
    tags: ["beast"],
    image: "/images/monster/spider.webp",
    hp: 55,
    atk: 7,
    def: 3,
    spd: 6,
    exp: 6,
  },
  산적: {
    name: "산적",
    tags: ["humanoid"],
    image: "/images/monster/bandit.webp",
    hp: 75,
    atk: 9,
    def: 4,
    spd: 4,
    exp: 8,
  },
  "호수 님프": {
    name: "호수 님프",
    tags: ["spirit"],
    image: "/images/monster/lakenymph.webp",
    hp: 90,
    atk: 11,
    def: 5,
    spd: 5,
    exp: 10,
  },
};

export function getMonstersByTag(tag: MonsterTag): Monster[] {
  return Object.values(MONSTERS).filter((m) => m.tags.includes(tag));
}
