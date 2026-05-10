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

// 드롭은 다섯 가지 — 재료 / 골드 / 장비 / 제작서 / 제작서 풀(랜덤 1). chance 는 0~1.
// "recipe" 드롭은 해당 제작법을 학습 (이미 알고 있으면 무시).
// "recipe_one_of" 는 chance 가 통과하면 recipeIds 중 하나를 균등 추첨해 학습 시도.
export type MonsterDrop =
  | { kind: "material"; materialId: MaterialId; chance: number; amount?: number }
  | { kind: "gold"; amount: number; chance: number }
  | { kind: "equip"; itemId: ItemId; chance: number }
  | { kind: "recipe"; recipeId: string; chance: number }
  | { kind: "recipe_one_of"; recipeIds: string[]; chance: number };

// 몬스터 페이즈 트리거 — HP가 hpFraction(0~1) 미만으로 떨어지면 1회 발동.
// defBonus 만큼 적의 DEF 가 영구 증가, 로그에 message 가 출력된다. 보스용.
export type MonsterPhaseTrigger = {
  hpFraction: number;
  defBonus: number;
  message: string;
};

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
  phaseTrigger?: MonsterPhaseTrigger;
  /** 처치 시 set 할 storyFlag id — 보스용. 두 번째 처치부터는 useStoryFlags.set 이 idempotent 라 무시. */
  onDefeatFlag?: string;
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
    drops: [
      { kind: "equip", itemId: "mole_king_drill", chance: 0.0002 },
    ],
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
      { kind: "gold", amount: 1, chance: 0.0777 },
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
    image: "/images/monster/brokengolem.webp",
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
    image: "/images/monster/wraith.webp",
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
    image: "/images/monster/minigolem.webp",
    hp: 110,
    atk: 9,
    def: 5,
    spd: 3,
    exp: 9,
    drops: [
      { kind: "material", materialId: "mana_crystal", chance: 0.001 },
    ],
  },
  // 깊은 동굴 보스 — region.boss 도전 버튼으로만 진입. 일반 인카운터 풀에선 제외.
  // 일일 도전 횟수 제한이 region.boss.dailyEntryLimit 으로 정해진다.
  // 처치 시 항상 마정석 1 + 마정석 무기 제작서 4종 중 1종 학습 (이미 안다면 무시).
  "광맥의 수호자": {
    name: "광맥의 수호자",
    tags: ["golem"],
    image: "/images/monster/oreguardian.webp",
    hp: 380,
    atk: 18,
    def: 10,
    spd: 3,
    exp: 60,
    drops: [
      { kind: "material", materialId: "mana_crystal", chance: 1, amount: 2 },
      {
        kind: "recipe_one_of",
        recipeIds: ["mana_sword", "mana_shield", "mana_spear", "mana_knuckle"],
        chance: 1,
      },
      { kind: "recipe", recipeId: "mana_bracelet", chance: 0.15 },
    ],
    phaseTrigger: {
      hpFraction: 0.3,
      defBonus: 4,
      message: "수호자가 단단해지기 시작했다.",
    },
  },
  "폐허 늑대": {
    name: "폐허 늑대",
    tags: ["beast", "undead"],
    image: "/images/monster/ruinwolf.webp",
    hp: 130,
    atk: 12,
    def: 4,
    spd: 6,
    exp: 11,
    drops: [
      { kind: "material", materialId: "wilddog_fang", chance: 0.03 },
    ],
  },
  // ── 운향 라인 (highland / canyon) ───────────────────────────────────────
  산양: {
    name: "산양",
    tags: ["beast"],
    hp: 180,
    atk: 22,
    def: 7,
    spd: 5,
    exp: 24,
    image: "/images/monster/mountaingoat.webp",
    drops: [
      { kind: "material", materialId: "sancho_blossom", chance: 0.02 },
      { kind: "material", materialId: "tough_hide", chance: 0.03 },
    ],
  },
  "바위 두꺼비": {
    name: "바위 두꺼비",
    tags: ["beast"],
    hp: 240,
    atk: 19,
    def: 12,
    spd: 3,
    exp: 28,
    image: "/images/monster/stonefrog.webp",
    drops: [
      { kind: "material", materialId: "unbong_ore", chance: 0.02 },
    ],
  },
  "절벽 늑대": {
    name: "절벽 늑대",
    tags: ["beast"],
    hp: 240,
    atk: 22,
    def: 9,
    spd: 7,
    exp: 32,
    image: "/images/monster/mountainwolf.webp",
    drops: [
      { kind: "material", materialId: "wilddog_fang", chance: 0.05 },
      { kind: "material", materialId: "sancho_blossom", chance: 0.03 },
    ],
  },
  "돌풍 정령": {
    name: "돌풍 정령",
    tags: ["spirit"],
    hp: 190,
    atk: 21,
    def: 9,
    spd: 8,
    evasionPct: 20,
    exp: 35,
    drops: [
      { kind: "material", materialId: "fairy_dust", chance: 0.04 },
      { kind: "material", materialId: "wind_mana_stone", chance: 0.02 },
    ],
  },
  "늑대 무리장": {
    name: "늑대 무리장",
    tags: ["beast"],
    hp: 240,
    atk: 22,
    def: 12,
    spd: 8,
    exp: 50,
    drops: [
      { kind: "material", materialId: "wolf_king_fang", chance: 0.005 },
      { kind: "material", materialId: "giant_scale", chance: 0.08 },
    ],
  },
  // 운향 협곡 보스 — region.boss 도전 버튼으로만 진입. 일반 인카운터 풀에선 제외.
  // 처치 시 거인 비늘 ×3 + 운봉석 ×2 확정 + 운봉 무기 4종 중 1 + 견갑 15% 학습.
  // onDefeatFlag 가 peak_giant_defeated 를 set 하여 운향 도시 진입로가 열림.
  "운봉의 거인": {
    name: "운봉의 거인",
    tags: ["golem"],
    hp: 420,
    atk: 25,
    def: 14,
    spd: 4,
    exp: 200,
    drops: [
      { kind: "material", materialId: "giant_scale", chance: 1, amount: 3 },
      { kind: "material", materialId: "unbong_ore", chance: 1, amount: 2 },
      {
        kind: "recipe_one_of",
        recipeIds: ["peak_sword", "peak_shield", "peak_spear", "peak_claw"],
        chance: 1,
      },
      { kind: "recipe", recipeId: "peak_mantle", chance: 0.15 },
    ],
    phaseTrigger: {
      hpFraction: 0.4,
      defBonus: 3,
      message: "거인이 두 발을 단단히 박아 넣는다.",
    },
    onDefeatFlag: "peak_giant_defeated",
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
