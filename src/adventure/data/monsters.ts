import type { MaterialId } from "./materials";
import type { ItemId } from "./items";

export type MonsterTag =
  | "humanoid"
  | "beast"
  | "slime"
  | "golem"
  | "spirit"
  | "undead"
  | "dragon";

// 드롭은 세 가지 — 재료 / 골드 / 장비. chance 는 0~1.
export type MonsterDrop =
  | { kind: "material"; materialId: MaterialId; chance: number }
  | { kind: "gold"; amount: number; chance: number }
  | { kind: "equip"; itemId: ItemId; chance: number };

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
    hp: 22,
    atk: 1,
    def: 0,
    spd: 1,
    exp: 1,
    drops: [{ kind: "material", materialId: "rusty_nail", chance: 0.1 }],
  },
  슬라임: {
    name: "슬라임",
    tags: ["slime"],
    image: "/images/monster/slime.webp",
    hp: 33,
    atk: 2,
    def: 1,
    spd: 1,
    exp: 2,
    drops: [
      { kind: "material", materialId: "slime_chunk", chance: 0.1 },
      { kind: "material", materialId: "slime_core", chance: 0.01 },
    ],
  },
  들개: {
    name: "들개",
    tags: ["beast"],
    image: "/images/monster/wilddog.webp",
    hp: 38,
    atk: 3,
    def: 1,
    spd: 4,
    exp: 3,
    drops: [
      { kind: "material", materialId: "wilddog_hide", chance: 0.1 },
      { kind: "material", materialId: "wilddog_fang", chance: 0.03 },
    ],
  },
  두더지: {
    name: "두더지",
    tags: ["beast"],
    image: "/images/monster/mole.webp",
    hp: 27,
    atk: 2,
    def: 0,
    spd: 3,
    exp: 2,
  },
  박쥐: {
    name: "박쥐",
    tags: ["beast"],
    image: "/images/monster/bat.webp",
    hp: 49,
    atk: 5,
    def: 2,
    spd: 7,
    exp: 4,
    drops: [{ kind: "material", materialId: "bat_eye", chance: 0.05 }],
  },
  동굴뱀: {
    name: "동굴뱀",
    tags: ["beast"],
    image: "/images/monster/cavesnake.webp",
    hp: 57,
    atk: 6,
    def: 2,
    spd: 5,
    exp: 5,
    drops: [{ kind: "material", materialId: "hard_crystal", chance: 0.05 }],
  },
  거미: {
    name: "거미",
    tags: ["beast"],
    image: "/images/monster/spider.webp",
    hp: 72,
    atk: 7,
    def: 3,
    spd: 6,
    exp: 6,
    drops: [{ kind: "material", materialId: "spider_silk", chance: 0.15 }],
  },
  산적: {
    name: "산적",
    tags: ["humanoid"],
    image: "/images/monster/bandit.webp",
    hp: 98,
    atk: 9,
    def: 4,
    spd: 4,
    exp: 8,
    drops: [
      { kind: "gold", amount: 1, chance: 0.2 },
      { kind: "equip", itemId: "bandit_dagger", chance: 0.005 },
    ],
  },
  "호수 님프": {
    name: "호수 님프",
    tags: ["spirit"],
    image: "/images/monster/lakenymph.webp",
    hp: 117,
    atk: 11,
    def: 5,
    spd: 5,
    exp: 10,
    drops: [
      { kind: "material", materialId: "fairy_dust", chance: 0.05 },
      { kind: "equip", itemId: "nymph_ring", chance: 0.005 },
    ],
  },
};

export function getMonstersByTag(tag: MonsterTag): Monster[] {
  return Object.values(MONSTERS).filter((m) => m.tags.includes(tag));
}
