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

// 드롭은 네 가지 — 재료 / 골드 / 장비 / 제작서. chance 는 0~1.
// "recipe" 드롭은 해당 제작법을 학습 (이미 알고 있으면 무시).
export type MonsterDrop =
  | { kind: "material"; materialId: MaterialId; chance: number }
  | { kind: "gold"; amount: number; chance: number }
  | { kind: "equip"; itemId: ItemId; chance: number }
  | { kind: "recipe"; recipeId: string; chance: number };

export type Monster = {
  name: string;
  tags: MonsterTag[];
  image?: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  /** 0~100. 플레이어 공격을 % 확률로 회피. 0/undefined = 항상 피격. */
  evasionPct?: number;
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
    drops: [
      { kind: "material", materialId: "rusty_nail", chance: 0.1 },
      { kind: "recipe", recipeId: "nailed_baseball_bat", chance: 0.003 },
    ],
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
      { kind: "material", materialId: "wilddog_hide", chance: 0.03 },
      { kind: "material", materialId: "wilddog_fang", chance: 0.015 },
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
    drops: [
      { kind: "material", materialId: "bat_eye", chance: 0.02 },
      { kind: "recipe", recipeId: "bat_hood", chance: 0.004 },
    ],
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
    drops: [
      { kind: "material", materialId: "hard_crystal", chance: 0.02 },
      { kind: "recipe", recipeId: "crystal_dagger", chance: 0.004 },
    ],
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
    drops: [
      { kind: "material", materialId: "spider_silk", chance: 0.03 },
      { kind: "recipe", recipeId: "sticky_cloak", chance: 0.003 },
    ],
  },
  산적: {
    name: "산적",
    tags: ["humanoid"],
    image: "/images/monster/bandit.webp",
    hp: 98,
    atk: 9,
    def: 3,
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
    def: 4,
    spd: 5,
    exp: 10,
    drops: [
      { kind: "material", materialId: "fairy_dust", chance: 0.02 },
      { kind: "equip", itemId: "nymph_ring", chance: 0.005 },
      { kind: "recipe", recipeId: "fairy_blessing", chance: 0.002 },
    ],
  },
  "부서진 골렘": {
    name: "부서진 골렘",
    tags: ["golem"],
    hp: 180,
    atk: 13,
    def: 6,
    spd: 2,
    exp: 14,
    drops: [
      { kind: "material", materialId: "ruin_fragment", chance: 0.05 },
      { kind: "recipe", recipeId: "golem_armor", chance: 0.02 },
      { kind: "equip", itemId: "golem_hammer", chance: 0.001 },
    ],
  },
  "떠도는 망령": {
    name: "떠도는 망령",
    tags: ["undead", "spirit"],
    hp: 95,
    atk: 14,
    def: 3,
    spd: 8,
    evasionPct: 20,
    exp: 13,
    drops: [
      { kind: "material", materialId: "soul_crystal", chance: 0.01 },
      { kind: "equip", itemId: "wraith_cloak", chance: 0.002 },
    ],
  },
  "작은 광물 골렘": {
    name: "작은 광물 골렘",
    tags: ["golem"],
    hp: 110,
    atk: 9,
    def: 5,
    spd: 3,
    exp: 9,
  },
  // 깊은 동굴 보스 — region.boss 도전 버튼으로만 진입. 일반 인카운터 풀에선 제외.
  // 일일 도전 횟수 제한이 region.boss.dailyEntryLimit 으로 정해진다.
  // 보상(드랍)은 추후 광물 강화 라인 도입 시 추가.
  "광맥의 수호자": {
    name: "광맥의 수호자",
    tags: ["golem"],
    hp: 380,
    atk: 18,
    def: 10,
    spd: 3,
    exp: 60,
  },
  "폐허 늑대": {
    name: "폐허 늑대",
    tags: ["beast", "undead"],
    hp: 130,
    atk: 12,
    def: 4,
    spd: 6,
    exp: 11,
    drops: [
      { kind: "material", materialId: "wilddog_fang", chance: 0.03 },
    ],
  },
  // 훈련용 더미 — 일반 인카운터 풀에 들어가지 않는 스파링 전용 몬스터.
  // 보상/패널티 모두 우회 (SparringView 가 onBattleEnd 를 호출하지 않음).
  "훈련용 허수아비": {
    name: "훈련용 허수아비",
    tags: ["humanoid"],
    image: "/images/monster/scarecrow.webp",
    hp: 80,
    atk: 4,
    def: 2,
    spd: 1,
    exp: 0,
  },
};

export const SPAR_DUMMY_ID = "훈련용 허수아비" as const;

export function getMonstersByTag(tag: MonsterTag): Monster[] {
  return Object.values(MONSTERS).filter((m) => m.tags.includes(tag));
}
