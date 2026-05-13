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

// 잡몹 스킬 — 몬스터당 최대 1개(옵셔널). 전투 엔진의 적 페이즈에서 처리.
//  - heavy_blow: everyPhases 번째 적 페이즈마다 그 공격 데미지 ×multiplier (강타).
//  - enrage:     적 HP 가 maxHp×hpFraction 미만으로 떨어지는 순간 1회 발동, ATK +atkBonus (전투 종료까지 유지).
//  - brace:      플레이어가 이 적을 공격할 때 데미지 -damageReduction (최소 1로 클램프).
//  - pierce:     이 적의 공격이 플레이어 DEF 를 armorPierce 만큼 무시.
// name 은 전투 로그에 [name] 으로 찍힌다.
export type MonsterSkill =
  | { kind: "heavy_blow"; name: string; everyPhases: number; multiplier: number }
  | { kind: "enrage"; name: string; hpFraction: number; atkBonus: number }
  | { kind: "brace"; name: string; damageReduction: number }
  | { kind: "pierce"; name: string; armorPierce: number };

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
  /** 잡몹 스킬 — 적 페이즈에서 처리되는 단순 능력 1개. */
  skill?: MonsterSkill;
  /**
   * 드랍 장비 품질 등급(정교한/빼어난) 가중치 배수. 기본 1. 미니보스 ≈2 / 지역 보스 ≈3 /
   * 레이드급 ≈4 권장 — 비-기본 등급 가중치(raw 4/1)에 곱해진 뒤 정규화된다(dropQuality.ts).
   */
  dropQualityBias?: number;
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
      // 초반 발판 — 낡은 가죽갑옷(볼드 무료 지급) → 덧댄 가죽갑옷. Lv 한 자릿수 안에 받게 드랍률 ↑.
      { kind: "recipe", recipeId: "reinforced_leather_armor", chance: 0.04 },
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
      // 유실된 명품 — 두더지왕의 드릴과 같은 부류(unique). 잡몹이 떡상 장신구를 떨군다.
      { kind: "equip", itemId: "bat_swarm_charm", chance: 0.0002 },
      // bat_swarm_charm 을 한 단계 끌어올리는 개조서 (결과도 unique·비거래).
      { kind: "recipe", recipeId: "bat_swarm_guide", chance: 0.003 },
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
      // 유실된 명품(unique) — 행운 +7 갑옷. "운으로 성장하는" 손맛 전용.
      { kind: "equip", itemId: "spider_queen_silk_robe", chance: 0.0002 },
      // 그 비단갑을 한 단계 끌어올리는 직조서 (결과도 unique·비거래).
      { kind: "recipe", recipeId: "spider_queen_silk_plate", chance: 0.002 },
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
      // 초반 발판 — 산적의 단검 → 두목의 단검 체인. 베이스/제작서 둘 다 드랍률 ↑.
      { kind: "equip", itemId: "bandit_dagger", chance: 0.015 },
      { kind: "recipe", recipeId: "bandit_chief_dagger", chance: 0.04 },
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
      { kind: "recipe", recipeId: "nymph_blessing", chance: 0.002 },
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
      { kind: "recipe", recipeId: "reforged_golem_hammer", chance: 0.015 },
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
      { kind: "recipe", recipeId: "wraithking_cloak", chance: 0.002 },
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
      // 두더지왕의 드릴(유실된 명품)을 한 단계 끌어올리는 개조서 (결과도 unique·비거래).
      { kind: "recipe", recipeId: "mole_king_borer", chance: 0.05 },
    ],
    dropQualityBias: 3,
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
      // 유실된 명품(unique) — 폐허에 박혀 있던 옛 영웅검의 윗동강. atk +8 / def -2.
      { kind: "equip", itemId: "hero_broken_sword", chance: 0.00015 },
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
    exp: 18,
    image: "/images/monster/mountaingoat.webp",
    drops: [
      { kind: "material", materialId: "sancho_blossom", chance: 0.02 },
      { kind: "material", materialId: "tough_hide", chance: 0.03 },
      { kind: "recipe", recipeId: "potion_heal_m", chance: 0.01 },
    ],
  },
  "바위 두꺼비": {
    name: "바위 두꺼비",
    tags: ["beast"],
    hp: 240,
    atk: 19,
    def: 12,
    spd: 3,
    exp: 22,
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
    exp: 22,
    image: "/images/monster/mountainwolf.webp",
    drops: [
      { kind: "material", materialId: "wilddog_fang", chance: 0.05 },
      { kind: "material", materialId: "sancho_blossom", chance: 0.03 },
      { kind: "recipe", recipeId: "potion_heal_m", chance: 0.01 },
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
    exp: 24,
    image: "/images/monster/icespirit.webp",
    drops: [
      { kind: "material", materialId: "fairy_dust", chance: 0.04 },
      { kind: "material", materialId: "wind_mana_stone", chance: 0.02 },
      { kind: "recipe", recipeId: "windmana_charm", chance: 0.004 },
    ],
  },
  "늑대 무리장": {
    name: "늑대 무리장",
    tags: ["beast"],
    hp: 240,
    atk: 22,
    def: 12,
    spd: 8,
    exp: 32,
    image: "/images/monster/wolfchieftain.webp",
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
    image: "/images/monster/frostgiant.webp",
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
    dropQualityBias: 4,
    phaseTrigger: {
      hpFraction: 0.4,
      defBonus: 3,
      message: "거인이 두 발을 단단히 박아 넣는다.",
    },
    onDefeatFlag: "peak_giant_defeated",
  },
  // ── 다리 구간 — 운저 평원 (cloud_plain) ─────────────────────────────────
  들소: {
    name: "들소",
    tags: ["beast"],
    image: "/images/monster/bison.webp",
    hp: 320,
    atk: 28,
    def: 14,
    spd: 4,
    exp: 30,
    drops: [
      { kind: "material", materialId: "bison_hide", chance: 0.015 },
      { kind: "equip", itemId: "bison_hide_armor", chance: 0.003 },
    ],
    skill: { kind: "heavy_blow", name: "들이받기", everyPhases: 3, multiplier: 1.5 },
  },
  "초원 매": {
    name: "초원 매",
    tags: ["beast"],
    image: "/images/monster/plainfalcon.webp",
    hp: 230,
    atk: 30,
    def: 8,
    spd: 11,
    evasionPct: 25,
    exp: 26,
    drops: [
      { kind: "material", materialId: "hawk_feather", chance: 0.02 },
      // 유실된 명품(unique) — 매의 발에 끼워져 있던 발톱 모양 쇳조각. atk +9 / dex +5.
      { kind: "equip", itemId: "sky_render_talon", chance: 0.00015 },
      // 그 발톱을 한 단계 끌어올리는 세공서 (결과도 unique·비거래).
      { kind: "recipe", recipeId: "azure_talon", chance: 0.003 },
    ],
    skill: { kind: "pierce", name: "급강하", armorPierce: 2 },
  },
  "떠돌이 약탈자": {
    name: "떠돌이 약탈자",
    tags: ["humanoid"],
    image: "/images/monster/rogue.webp",
    hp: 280,
    atk: 27,
    def: 11,
    spd: 6,
    exp: 28,
    drops: [
      { kind: "gold", amount: 1, chance: 0.08 },
      { kind: "material", materialId: "wilddog_fang", chance: 0.01 },
    ],
    skill: { kind: "pierce", name: "급소 노리기", armorPierce: 3 },
  },
  // ── 다리 구간 — 잿빛 협로 (ashen_pass) ──────────────────────────────────
  "재먼지 골렘": {
    name: "재먼지 골렘",
    tags: ["golem"],
    image: "/images/monster/ashegolem.webp",
    hp: 420,
    atk: 33,
    def: 20,
    spd: 3,
    exp: 38,
    drops: [
      { kind: "material", materialId: "ash_stone", chance: 0.02 },
      { kind: "material", materialId: "ruin_fragment", chance: 0.015 },
      { kind: "recipe", recipeId: "ashforged_blade", chance: 0.015 },
    ],
    skill: { kind: "brace", name: "잿가루 장막", damageReduction: 2 },
  },
  "잿빛 들개": {
    name: "잿빛 들개",
    tags: ["beast"],
    image: "/images/monster/ashewolf.webp",
    hp: 330,
    atk: 36,
    def: 12,
    spd: 8,
    exp: 34,
    drops: [
      { kind: "material", materialId: "ash_stone", chance: 0.01 },
      { kind: "material", materialId: "wilddog_fang", chance: 0.015 },
    ],
    skill: { kind: "heavy_blow", name: "물어뜯기", everyPhases: 3, multiplier: 1.5 },
  },
  "불씨 도롱뇽": {
    name: "불씨 도롱뇽",
    tags: ["beast"],
    image: "/images/monster/embersalamander.webp",
    hp: 300,
    atk: 34,
    def: 14,
    spd: 9,
    exp: 33,
    drops: [
      { kind: "material", materialId: "ash_stone", chance: 0.01 },
      { kind: "material", materialId: "flame_scale", chance: 0.005 },
    ],
    skill: { kind: "enrage", name: "발화", hpFraction: 0.5, atkBonus: 4 },
  },
  // ── 봉황령 (phoenix_ridge) ───────────────────────────────────────────────
  "불꽃 독수리": {
    name: "불꽃 독수리",
    tags: ["beast"],
    image: "/images/monster/flamehawk.webp",
    hp: 350,
    atk: 38,
    def: 12,
    spd: 12,
    evasionPct: 25,
    exp: 40,
    drops: [
      { kind: "material", materialId: "phoenix_feather", chance: 0.01 },
      { kind: "equip", itemId: "flame_eagle_cape", chance: 0.003 },
      { kind: "recipe", recipeId: "potion_heal_l", chance: 0.008 },
      { kind: "recipe", recipeId: "phoenix_flight_cape", chance: 0.004 },
    ],
    skill: { kind: "pierce", name: "강하 일격", armorPierce: 4 },
  },
  "화염 도마뱀": {
    name: "화염 도마뱀",
    tags: ["beast"],
    image: "/images/monster/firelizard.webp",
    hp: 420,
    atk: 36,
    def: 18,
    spd: 8,
    exp: 38,
    drops: [
      { kind: "material", materialId: "flame_scale", chance: 0.015 },
      { kind: "recipe", recipeId: "potion_heal_l", chance: 0.008 },
    ],
    skill: { kind: "enrage", name: "화염 비늘 폭발", hpFraction: 0.4, atkBonus: 6 },
  },
  "산악 기사": {
    name: "산악 기사",
    tags: ["humanoid"],
    image: "/images/monster/mountainknight.webp",
    hp: 500,
    atk: 44,
    def: 22,
    spd: 6,
    exp: 48,
    drops: [
      { kind: "material", materialId: "flame_scale", chance: 0.005 },
      { kind: "material", materialId: "giant_scale", chance: 0.004 },
    ],
    skill: { kind: "brace", name: "방패 막기", damageReduction: 3 },
  },
  // ── 화산 지대 (volcanic_badlands) ───────────────────────────────────────
  "용암 슬라임": {
    name: "용암 슬라임",
    tags: ["slime"],
    image: "/images/monster/lavaslime.webp",
    hp: 540,
    atk: 50,
    def: 24,
    spd: 4,
    exp: 55,
    drops: [
      { kind: "material", materialId: "lava_core", chance: 0.003 },
      // 유실된 명품(unique) — 미처 못 녹인 거대 용암 핵. atk +11 / spd -2. 가장 희귀한 한 자루.
      { kind: "equip", itemId: "lava_core_maul", chance: 0.0001 },
      // 그 망치를 한 단계 끌어올리는 단조서 (결과도 unique·비거래).
      { kind: "recipe", recipeId: "lava_core_greatmaul", chance: 0.005 },
    ],
    skill: { kind: "heavy_blow", name: "용암 비산", everyPhases: 4, multiplier: 1.5 },
  },
  "화산 두꺼비": {
    name: "화산 두꺼비",
    tags: ["beast"],
    image: "/images/monster/flamefrog.webp",
    hp: 620,
    atk: 55,
    def: 30,
    spd: 3,
    exp: 62,
    drops: [
      { kind: "material", materialId: "lava_core", chance: 0.005 },
    ],
    skill: { kind: "enrage", name: "용암 분출", hpFraction: 0.4, atkBonus: 8 },
  },
  "불꽃 골렘": {
    name: "불꽃 골렘",
    tags: ["golem"],
    image: "/images/monster/moltengolem.webp",
    hp: 680,
    atk: 60,
    def: 26,
    spd: 5,
    exp: 70,
    drops: [
      { kind: "material", materialId: "lava_core", chance: 0.009 },
      { kind: "material", materialId: "ruin_fragment", chance: 0.025 },
    ],
    skill: { kind: "heavy_blow", name: "과열 가동", everyPhases: 3, multiplier: 1.5 },
  },
  // 화산 지대 보스 — 처치 시 volcano_heart_defeated flag → 천공 성지 개방.
  "화산의 심장": {
    name: "화산의 심장",
    tags: ["golem"],
    image: "/images/monster/volcanicheart.webp",
    hp: 1200,
    atk: 72,
    def: 32,
    spd: 6,
    exp: 400,
    drops: [
      { kind: "material", materialId: "lava_core", chance: 1, amount: 4 },
      { kind: "material", materialId: "phoenix_feather", chance: 1, amount: 3 },
      { kind: "material", materialId: "flame_scale", chance: 1, amount: 5 },
      {
        kind: "recipe_one_of",
        recipeIds: ["volcano_sword", "volcano_shield", "volcano_spear", "volcano_claw"],
        chance: 1,
      },
      { kind: "recipe", recipeId: "volcano_armor", chance: 0.15 },
      { kind: "recipe", recipeId: "volcano_core", chance: 0.15 },
    ],
    dropQualityBias: 4,
    phaseTrigger: {
      hpFraction: 0.4,
      defBonus: 6,
      message: "화산의 심장이 붉게 달아오른다.",
    },
    onDefeatFlag: "volcano_heart_defeated",
  },
  // ── 해안 지선 (조수 갯벌 / 산호초 섬) ───────────────────────────────────
  // 폐허(Lv9)~산기슭(Lv18) 사이에 놓이는 바닷길 잡몹. image 필드는 후속 PR 에서 추가.
  "집게발 게": {
    name: "집게발 게",
    tags: ["beast"],
    hp: 150,
    atk: 11,
    def: 8,
    spd: 3,
    exp: 11,
    drops: [
      { kind: "material", materialId: "crab_shell", chance: 0.06 },
    ],
  },
  갯도요: {
    name: "갯도요",
    tags: ["beast"],
    hp: 95,
    atk: 12,
    def: 3,
    spd: 9,
    evasionPct: 20,
    exp: 11,
    drops: [
      { kind: "material", materialId: "crab_shell", chance: 0.02 },
    ],
  },
  "진흙 미꾸라지": {
    name: "진흙 미꾸라지",
    tags: ["beast"],
    hp: 120,
    atk: 10,
    def: 4,
    spd: 6,
    exp: 10,
    drops: [
      { kind: "material", materialId: "crab_shell", chance: 0.03 },
    ],
  },
  "산호초 사이렌": {
    name: "산호초 사이렌",
    tags: ["spirit"],
    hp: 175,
    atk: 21,
    def: 6,
    spd: 7,
    evasionPct: 20,
    exp: 20,
    drops: [
      { kind: "material", materialId: "deep_scale", chance: 0.04 },
    ],
  },
  "갑각 약탈자": {
    name: "갑각 약탈자",
    tags: ["humanoid"],
    hp: 210,
    atk: 19,
    def: 9,
    spd: 6,
    exp: 21,
    drops: [
      { kind: "material", materialId: "crab_shell", chance: 0.05 },
      { kind: "material", materialId: "coral_spine", chance: 0.02 },
    ],
  },
  "가시 산호 골렘": {
    name: "가시 산호 골렘",
    tags: ["golem"],
    hp: 250,
    atk: 17,
    def: 13,
    spd: 2,
    exp: 22,
    drops: [
      { kind: "material", materialId: "coral_spine", chance: 0.05 },
    ],
  },
  // 훈련용 더미 — 일반 인카운터 풀에 들어가지 않는 스파링 전용 몬스터.
  // 보상/패널티 모두 우회 (SparringView 가 onBattleEnd 를 호출하지 않음).
  "훈련용 허수아비": {
    name: "훈련용 허수아비",
    tags: ["humanoid"],
    image: "/images/monster/scarecrow.webp",
    hp: 5000,
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
